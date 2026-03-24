from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.approval import Approval
from app.models.correspondence_item import CorrespondenceItem
from app.models.enums import ApprovalDecision, OutgoingItemStatus, RoleCode, SeriesStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.approval import ApprovalDecisionRequest, ApprovalQueueItem, ApprovalRead, ApprovalSubmitRequest
from app.services.audit import log_audit
from app.services.response_cache import invalidate_response_cache

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("/submit", response_model=ApprovalRead, status_code=status.HTTP_201_CREATED)
async def submit_for_approval(
    payload: ApprovalSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalRead:
    item_result = await db.execute(select(CorrespondenceItem).where(CorrespondenceItem.id == payload.item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    approval = Approval(
        item_id=payload.item_id,
        submitted_by_user_id=current_user.id,
        submitted_to_user_id=payload.submitted_to_user_id,
        decision=ApprovalDecision.PENDING,
        comments=payload.comments,
    )
    db.add(approval)
    await db.flush()

    item.outgoing_status = OutgoingItemStatus.APPROVAL_PENDING
    series_result = await db.execute(select(Series).where(Series.id == item.series_id))
    series = series_result.scalar_one_or_none()
    if series:
        series.status = SeriesStatus.AWAITING_APPROVAL

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="approval.submitted",
        entity="approval",
        entity_id=str(approval.id),
        description=f"Item {payload.item_id} sent for approval",
    )
    await db.commit()
    await db.refresh(approval)
    await invalidate_response_cache(
        [f"series:get:{item.series_id}", f"series:items:{item.series_id}", "series:list:", "dashboard:", "reports:"]
    )
    return ApprovalRead.model_validate(approval)


@router.post("/{approval_id}/decision", response_model=ApprovalRead)
async def decide_approval(
    approval_id: str,
    payload: ApprovalDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalRead:
    approval_result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = approval_result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval not found.")
    is_admin = bool(current_user.role and current_user.role.code == RoleCode.ADMIN)
    if approval.submitted_to_user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned approver can decide this item.")

    approval.decision = payload.decision
    approval.comments = payload.comments or approval.comments
    approval.sent_back_reason = payload.sent_back_reason
    approval.decided_at = datetime.now(timezone.utc)

    item_result = await db.execute(select(CorrespondenceItem).where(CorrespondenceItem.id == approval.item_id))
    item = item_result.scalar_one()
    series_result = await db.execute(select(Series).where(Series.id == item.series_id))
    series = series_result.scalar_one_or_none()

    if payload.decision == ApprovalDecision.APPROVED:
        item.outgoing_status = OutgoingItemStatus.APPROVED
        if series:
            series.status = SeriesStatus.AWAITING_EXTERNAL_RESPONSE
    elif payload.decision == ApprovalDecision.SENT_BACK:
        item.outgoing_status = OutgoingItemStatus.SENT_BACK_FOR_CHANGES
        if series:
            series.status = SeriesStatus.AWAITING_INTERNAL_DRAFT

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="approval.decided",
        entity="approval",
        entity_id=str(approval.id),
        payload=payload.model_dump(),
    )
    await db.commit()
    await db.refresh(approval)
    await invalidate_response_cache(
        [f"series:get:{item.series_id}", f"series:items:{item.series_id}", "series:list:", "dashboard:", "reports:"]
    )
    return ApprovalRead.model_validate(approval)


@router.get("/item/{item_id}", response_model=list[ApprovalRead])
async def list_item_approvals(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ApprovalRead]:
    result = await db.execute(select(Approval).where(Approval.item_id == item_id).order_by(Approval.created_at.desc()))
    return [ApprovalRead.model_validate(row) for row in result.scalars().all()]


@router.get("/pending", response_model=list[ApprovalQueueItem])
async def list_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(RoleCode.APPROVER, RoleCode.ADMIN)),
) -> list[ApprovalQueueItem]:
    submitter = aliased(User)
    statement = (
        select(Approval, CorrespondenceItem, Series, submitter)
        .join(CorrespondenceItem, Approval.item_id == CorrespondenceItem.id)
        .join(Series, CorrespondenceItem.series_id == Series.id)
        .join(submitter, Approval.submitted_by_user_id == submitter.id)
        .where(Approval.decision == ApprovalDecision.PENDING)
        .order_by(Approval.created_at.asc())
    )
    is_admin = bool(current_user.role and current_user.role.code == RoleCode.ADMIN)
    if not is_admin:
        statement = statement.where(Approval.submitted_to_user_id == current_user.id)

    result = await db.execute(statement)
    rows = result.all()
    response: list[ApprovalQueueItem] = []
    for approval, item, series, submitter_user in rows:
        draft_text = (item.final_draft_text or item.ai_draft_text or "").strip()
        excerpt = draft_text[:280] if draft_text else None
        if excerpt and len(draft_text) > 280:
            excerpt += "..."
        response.append(
            ApprovalQueueItem(
                approval_id=str(approval.id),
                item_id=str(item.id),
                series_id=str(series.id),
                series_number=series.series_number,
                series_subject=series.subject,
                organization_name=series.organization_name,
                sequence_no=item.sequence_no,
                item_type=item.item_type,
                item_subject=item.subject,
                letter_number=item.letter_number,
                diary_number=item.diary_number,
                outgoing_status=item.outgoing_status,
                submitted_at=approval.created_at,
                submitted_by_user_id=str(approval.submitted_by_user_id),
                submitted_by_name=submitter_user.full_name if submitter_user else None,
                comments=approval.comments,
                current_decision=approval.decision,
                final_draft_excerpt=excerpt,
            )
        )
    return response
