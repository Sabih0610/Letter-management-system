from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.correspondence_item import CorrespondenceItem
from app.models.enums import Direction, OutgoingItemStatus, SeriesStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.dashboard import (
    ActivityEntry,
    AutomationSeriesCard,
    CategoryDashboardCard,
    DashboardAutomationResponse,
    DashboardResponse,
    DashboardSummary,
)
from app.services.response_cache import get_or_set_response

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CACHE_TTL_SECONDS = 30


def _as_int(value: int | None) -> int:
    return int(value or 0)


async def _fetch_recent_activity(db: AsyncSession, limit: int = 10) -> list[ActivityEntry]:
    activity_result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))
    return [
        ActivityEntry(
            action=row.action,
            entity=row.entity,
            entity_id=row.entity_id,
            timestamp=row.created_at.isoformat(),
            actor=str(row.actor_user_id) if row.actor_user_id else None,
        )
        for row in activity_result.scalars().all()
    ]


async def _build_dashboard_payload(db: AsyncSession, include_activity: bool) -> DashboardResponse:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    series_summary_result = await db.execute(
        select(
            func.sum(case((Series.status != SeriesStatus.CLOSED, 1), else_=0)).label("total_open_series"),
            func.sum(case((Series.status == SeriesStatus.AWAITING_EXTERNAL_RESPONSE, 1), else_=0)).label(
                "total_awaiting_external_response"
            ),
            func.sum(
                case(
                    (and_(Series.due_date.is_not(None), Series.due_date < now, Series.status != SeriesStatus.CLOSED), 1),
                    else_=0,
                )
            ).label("total_overdue"),
            func.sum(
                case(
                    (and_(Series.status == SeriesStatus.CLOSED, Series.closed_at.is_not(None), Series.closed_at >= month_start), 1),
                    else_=0,
                )
            ).label("recently_closed"),
        )
    )
    series_summary = series_summary_result.one()

    item_summary_result = await db.execute(
        select(
            func.sum(case((CorrespondenceItem.outgoing_status == OutgoingItemStatus.APPROVAL_PENDING, 1), else_=0)).label(
                "total_pending_approval"
            ),
            func.sum(case((CorrespondenceItem.outgoing_status == OutgoingItemStatus.DRAFT, 1), else_=0)).label(
                "total_drafts_in_progress"
            ),
        )
    )
    item_summary = item_summary_result.one()

    summary = DashboardSummary(
        total_open_series=_as_int(series_summary.total_open_series),
        total_pending_approval=_as_int(item_summary.total_pending_approval),
        total_overdue=_as_int(series_summary.total_overdue),
        total_awaiting_external_response=_as_int(series_summary.total_awaiting_external_response),
        total_drafts_in_progress=_as_int(item_summary.total_drafts_in_progress),
        recently_closed=_as_int(series_summary.recently_closed),
    )

    category_result = await db.execute(select(Category.id, Category.name).order_by(Category.name))
    categories = category_result.all()

    category_stats_result = await db.execute(
        select(
            Series.category_id.label("category_id"),
            func.sum(case((Series.status != SeriesStatus.CLOSED, 1), else_=0)).label("open_series"),
            func.sum(case((Series.status == SeriesStatus.AWAITING_INTERNAL_DRAFT, 1), else_=0)).label("pending_draft"),
            func.sum(case((Series.status == SeriesStatus.AWAITING_APPROVAL, 1), else_=0)).label("pending_approval"),
            func.sum(case((Series.status == SeriesStatus.AWAITING_EXTERNAL_RESPONSE, 1), else_=0)).label(
                "awaiting_external_response"
            ),
            func.sum(
                case(
                    (and_(Series.due_date.is_not(None), Series.due_date < now, Series.status != SeriesStatus.CLOSED), 1),
                    else_=0,
                )
            ).label("overdue_items"),
            func.sum(
                case(
                    (and_(Series.status == SeriesStatus.CLOSED, Series.closed_at.is_not(None), Series.closed_at >= month_start), 1),
                    else_=0,
                )
            ).label("closed_this_month"),
        )
        .group_by(Series.category_id)
    )
    stats_map = {str(row.category_id): row for row in category_stats_result.all()}

    category_cards: list[CategoryDashboardCard] = []
    for category_id, category_name in categories:
        row = stats_map.get(str(category_id))
        category_cards.append(
            CategoryDashboardCard(
                category_id=str(category_id),
                category_name=category_name,
                open_series=_as_int(getattr(row, "open_series", 0)),
                pending_draft=_as_int(getattr(row, "pending_draft", 0)),
                pending_approval=_as_int(getattr(row, "pending_approval", 0)),
                awaiting_external_response=_as_int(getattr(row, "awaiting_external_response", 0)),
                overdue_items=_as_int(getattr(row, "overdue_items", 0)),
                closed_this_month=_as_int(getattr(row, "closed_this_month", 0)),
            )
        )

    activity = await _fetch_recent_activity(db) if include_activity else []
    return DashboardResponse(summary=summary, categories=category_cards, recent_activity=activity)


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    include_activity: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardResponse:
    cache_key = f"dashboard:{'with_activity' if include_activity else 'without_activity'}"
    return await get_or_set_response(
        cache_key,
        CACHE_TTL_SECONDS,
        lambda: _build_dashboard_payload(db=db, include_activity=include_activity),
    )


@router.get("/activity", response_model=list[ActivityEntry])
async def get_dashboard_activity(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ActivityEntry]:
    return await _fetch_recent_activity(db=db, limit=10)


@router.get("/automation", response_model=DashboardAutomationResponse)
async def get_dashboard_automation(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardAutomationResponse:
    pending_approval = await db.scalar(
        select(func.count(CorrespondenceItem.id)).where(CorrespondenceItem.outgoing_status == OutgoingItemStatus.APPROVAL_PENDING)
    )
    drafts_in_progress = await db.scalar(
        select(func.count(CorrespondenceItem.id)).where(CorrespondenceItem.outgoing_status == OutgoingItemStatus.DRAFT)
    )

    smart_reply_result = await db.execute(
        select(
            Series.id.label("series_id"),
            Series.series_number,
            Series.subject.label("series_subject"),
            Series.organization_name,
            Series.updated_at,
            Series.due_date,
            CorrespondenceItem.id.label("item_id"),
            CorrespondenceItem.subject.label("item_subject"),
        )
        .join(CorrespondenceItem, CorrespondenceItem.id == Series.latest_item_id)
        .where(
            Series.status != SeriesStatus.CLOSED,
            CorrespondenceItem.direction == Direction.INCOMING,
        )
        .order_by(Series.updated_at.desc())
        .limit(8)
    )
    queue_rows = smart_reply_result.all()
    queue = [
        AutomationSeriesCard(
            series_id=str(row.series_id),
            series_number=row.series_number,
            subject=row.series_subject,
            organization_name=row.organization_name,
            latest_incoming_item_id=str(row.item_id),
            latest_incoming_subject=row.item_subject,
            updated_at=row.updated_at.isoformat(),
            due_date=row.due_date.isoformat() if row.due_date else None,
        )
        for row in queue_rows
    ]

    return DashboardAutomationResponse(
        awaiting_reply_series=len(queue),
        pending_approval_items=int(pending_approval or 0),
        drafts_in_progress=int(drafts_in_progress or 0),
        smart_reply_queue=queue,
    )
