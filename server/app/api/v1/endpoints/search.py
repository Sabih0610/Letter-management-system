from fastapi import APIRouter, Depends
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.correspondence_item import CorrespondenceItem
from app.models.dispatch_detail import DispatchDetail
from app.models.series import Series
from app.models.user import User
from app.schemas.search import SearchHit, SearchRequest, SearchResponse

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def global_search(
    payload: SearchRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SearchResponse:
    filters = []
    if payload.query:
        q = f"%{payload.query}%"
        filters.append(
            or_(
                Series.series_number.ilike(q),
                Series.subject.ilike(q),
                Series.organization_name.ilike(q),
                CorrespondenceItem.diary_number.ilike(q),
                CorrespondenceItem.letter_number.ilike(q),
                CorrespondenceItem.subject.ilike(q),
                CorrespondenceItem.sender_name.ilike(q),
                CorrespondenceItem.recipient_name.ilike(q),
                DispatchDetail.tracking_number.ilike(q),
            )
        )
    if payload.direction:
        filters.append(CorrespondenceItem.direction == payload.direction)
    if payload.category_id:
        filters.append(Series.category_id == payload.category_id)
    if payload.dispatch_mode:
        filters.append(CorrespondenceItem.mode == payload.dispatch_mode)
    if payload.courier_company:
        filters.append(DispatchDetail.courier_company == payload.courier_company)
    if payload.pod_received is not None:
        filters.append(DispatchDetail.pod_received == payload.pod_received)
    if payload.status:
        filters.append(Series.status == payload.status)
    if payload.department_id:
        filters.append(Series.assigned_department_id == payload.department_id)
    if payload.assigned_to_user_id:
        filters.append(Series.assigned_to_user_id == payload.assigned_to_user_id)

    statement = (
        select(Series, CorrespondenceItem, DispatchDetail)
        .join(CorrespondenceItem, CorrespondenceItem.series_id == Series.id, isouter=True)
        .join(DispatchDetail, DispatchDetail.item_id == CorrespondenceItem.id, isouter=True)
        .order_by(Series.updated_at.desc())
    )
    if filters:
        statement = statement.where(and_(*filters))

    result = await db.execute(statement)
    rows = result.all()
    items = [
        SearchHit(
            series_id=str(series.id),
            series_number=series.series_number,
            item_id=str(item.id) if item else None,
            diary_number=item.diary_number if item else None,
            letter_number=item.letter_number if item else None,
            subject=item.subject if item else series.subject,
            organization_name=series.organization_name,
            direction=item.direction if item else None,
            tracking_number=dispatch.tracking_number if dispatch else None,
        )
        for series, item, dispatch in rows
    ]
    return SearchResponse(total=len(items), items=items)

