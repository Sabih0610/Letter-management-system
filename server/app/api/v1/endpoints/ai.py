from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.ai_draft_log import AIDraftLog
from app.models.correspondence_item import CorrespondenceItem
from app.models.enums import Direction, ItemType, OutgoingItemStatus, SeriesStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.ai import AIDraftRequest, AIDraftResponse, AutoReplyRequest, AutoReplyResponse
from app.services.ai import build_ai_context, generate_draft_with_context, generate_fallback_draft
from app.services.audit import log_audit
from app.services.gemini import GeminiError
from app.services.numbering import generate_letter_number

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/draft", response_model=AIDraftResponse)
async def generate_ai_draft(
    payload: AIDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIDraftResponse:
    item_result = await db.execute(select(CorrespondenceItem).where(CorrespondenceItem.id == payload.item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    context = await build_ai_context(db, payload.item_id, payload)
    try:
        generated = await generate_draft_with_context(payload, context)
    except GeminiError:
        generated = generate_fallback_draft(context, payload)

    draft_text = generated["body_draft"]
    item.ai_draft_text = draft_text
    item.prompt_title = payload.prompt_title or item.prompt_title
    item.prompt_text = payload.prompt_instructions

    log = AIDraftLog(
        item_id=payload.item_id,
        generated_by_user_id=current_user.id,
        prompt_title=payload.prompt_title,
        prompt_instructions=payload.prompt_instructions,
        tone=payload.tone,
        draft_type=payload.draft_type,
        context_options={
            "selected_letter_item_id": payload.selected_letter_item_id,
            "use_selected_letter": payload.use_selected_letter,
            "use_uploaded_attachments": payload.use_uploaded_attachments,
            "use_previous_thread": payload.use_previous_thread,
            "thread_scope": payload.thread_scope,
            "file_scope": payload.file_scope,
            "use_approved_only": payload.use_approved_only,
            "draft_purpose": payload.draft_purpose,
        },
        context_preview=context["context_preview"],
        generated_text=draft_text,
    )
    db.add(log)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="ai.draft_generated",
        entity="correspondence_item",
        entity_id=str(item.id),
        payload={
            "prompt_title": payload.prompt_title,
            "thread_scope": payload.thread_scope,
            "file_scope": payload.file_scope,
            "draft_purpose": payload.draft_purpose,
        },
    )
    await db.commit()
    return AIDraftResponse(
        draft_text=draft_text,
        subject_suggestion=generated["subject_suggestion"],
        reference_line=generated["reference_line"],
        thread_summary=context.get("thread_summary"),
        context_preview=context["context_preview"],
    )


@router.post("/auto-reply", response_model=AutoReplyResponse)
async def auto_create_reply_draft(
    payload: AutoReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AutoReplyResponse:
    series_result = await db.execute(select(Series).where(Series.id == payload.series_id))
    series = series_result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found.")
    if series.status == SeriesStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot create draft for a closed series.")

    items_result = await db.execute(
        select(CorrespondenceItem)
        .where(CorrespondenceItem.series_id == series.id)
        .order_by(CorrespondenceItem.sequence_no.asc())
    )
    series_items = list(items_result.scalars().all())

    reply_target: CorrespondenceItem | None = None
    if payload.selected_letter_item_id:
        reply_target = next((item for item in series_items if str(item.id) == payload.selected_letter_item_id), None)
    if not reply_target:
        reply_target = next((item for item in reversed(series_items) if item.direction == Direction.INCOMING), None)
    if not reply_target:
        raise HTTPException(status_code=400, detail="No incoming letter found in this series to reply to.")

    max_sequence = await db.scalar(
        select(func.max(CorrespondenceItem.sequence_no)).where(CorrespondenceItem.series_id == series.id)
    )
    next_sequence = int(max_sequence or 0) + 1
    letter_number = await generate_letter_number(db)

    outgoing_item = CorrespondenceItem(
        series_id=series.id,
        sequence_no=next_sequence,
        direction=Direction.OUTGOING,
        item_type=ItemType.REPLY,
        letter_number=letter_number,
        subject=f"Reply: {reply_target.subject}",
        recipient_name=reply_target.sender_name or reply_target.sender_organization or series.organization_name,
        recipient_organization=reply_target.sender_organization or series.organization_name,
        recipient_address_email=None,
        in_reference_to=reply_target.diary_number or reply_target.letter_number or reply_target.subject,
        sent_date=datetime.now(timezone.utc),
        mode=reply_target.mode,
        outgoing_status=OutgoingItemStatus.DRAFT,
        mode_specific_data={"reply_to_item_id": str(reply_target.id)},
    )
    db.add(outgoing_item)
    await db.flush()

    ai_request = AIDraftRequest(
        item_id=str(outgoing_item.id),
        selected_letter_item_id=str(reply_target.id),
        prompt_title="Auto Reply",
        prompt_instructions=payload.prompt_instructions,
        tone=payload.tone,
        draft_type="reply",
        draft_purpose=payload.draft_purpose,
        key_points=[],
        legal_regulatory_angle=None,
        length_preference=payload.length_preference,
        use_selected_letter=True,
        use_uploaded_attachments=True,
        use_previous_thread=True,
        thread_scope=payload.thread_scope,
        file_scope=payload.file_scope,
        use_approved_only=False,
    )
    context = await build_ai_context(db, str(outgoing_item.id), ai_request)
    try:
        generated = await generate_draft_with_context(ai_request, context)
    except GeminiError:
        generated = generate_fallback_draft(context, ai_request)

    outgoing_item.ai_draft_text = generated["body_draft"]
    outgoing_item.prompt_title = ai_request.prompt_title
    outgoing_item.prompt_text = ai_request.prompt_instructions
    if generated.get("subject_suggestion"):
        outgoing_item.subject = generated["subject_suggestion"]
    if generated.get("reference_line"):
        outgoing_item.in_reference_to = generated["reference_line"]

    series.total_exchanges = next_sequence
    series.latest_direction = Direction.OUTGOING
    series.latest_item_id = outgoing_item.id
    series.status = SeriesStatus.AWAITING_INTERNAL_DRAFT

    draft_log = AIDraftLog(
        item_id=outgoing_item.id,
        generated_by_user_id=current_user.id,
        prompt_title=ai_request.prompt_title,
        prompt_instructions=ai_request.prompt_instructions,
        tone=ai_request.tone,
        draft_type=ai_request.draft_type,
        context_options={
            "auto_reply": True,
            "reply_target_item_id": str(reply_target.id),
            "thread_scope": ai_request.thread_scope,
            "file_scope": ai_request.file_scope,
        },
        context_preview=context["context_preview"],
        generated_text=generated["body_draft"],
    )
    db.add(draft_log)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="ai.auto_reply_generated",
        entity="correspondence_item",
        entity_id=str(outgoing_item.id),
        payload={
            "series_id": str(series.id),
            "reply_target_item_id": str(reply_target.id),
            "thread_scope": ai_request.thread_scope,
        },
    )
    await db.commit()

    return AutoReplyResponse(
        series_id=str(series.id),
        item_id=str(outgoing_item.id),
        letter_number=outgoing_item.letter_number,
        draft_text=generated["body_draft"],
        subject_suggestion=generated.get("subject_suggestion"),
        reference_line=generated.get("reference_line"),
    )
