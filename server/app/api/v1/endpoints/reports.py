from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.correspondence_item import CorrespondenceItem
from app.models.dispatch_detail import DispatchDetail
from app.models.enums import Direction, OutgoingItemStatus, SeriesStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.report import ReportMetric, ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=ReportResponse)
async def summary_report(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)) -> ReportResponse:
    metrics = [
        ReportMetric(label="Open Series", value=(await db.scalar(select(func.count(Series.id)).where(Series.status != SeriesStatus.CLOSED))) or 0),
        ReportMetric(label="Pending Approvals", value=(await db.scalar(
            select(func.count(CorrespondenceItem.id)).where(CorrespondenceItem.outgoing_status == OutgoingItemStatus.APPROVAL_PENDING)
        )) or 0),
        ReportMetric(label="Awaiting External Response", value=(await db.scalar(
            select(func.count(Series.id)).where(Series.status == SeriesStatus.AWAITING_EXTERNAL_RESPONSE)
        )) or 0),
        ReportMetric(label="Incoming Letters", value=(await db.scalar(
            select(func.count(CorrespondenceItem.id)).where(CorrespondenceItem.direction == Direction.INCOMING)
        )) or 0),
        ReportMetric(label="Outgoing Letters", value=(await db.scalar(
            select(func.count(CorrespondenceItem.id)).where(CorrespondenceItem.direction == Direction.OUTGOING)
        )) or 0),
        ReportMetric(label="POD Pending", value=(await db.scalar(
            select(func.count(DispatchDetail.id)).where(DispatchDetail.pod_required.is_(True), DispatchDetail.pod_received.is_(False))
        )) or 0),
    ]
    return ReportResponse(metrics=metrics)

