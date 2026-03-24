from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.correspondence_item import CorrespondenceItem
from app.models.dispatch_detail import DispatchDetail
from app.models.enums import Direction, OutgoingItemStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.dispatch import DispatchRead, DispatchUpsertRequest
from app.services.audit import log_audit
from app.services.response_cache import invalidate_response_cache

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.put("/item/{item_id}", response_model=DispatchRead)
async def upsert_dispatch(
    item_id: str,
    payload: DispatchUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DispatchRead:
    item_result = await db.execute(select(CorrespondenceItem).where(CorrespondenceItem.id == item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    existing_result = await db.execute(select(DispatchDetail).where(DispatchDetail.item_id == item_id))
    row = existing_result.scalar_one_or_none()
    data = payload.model_dump()
    if not row:
        row = DispatchDetail(item_id=item_id, **data)
        db.add(row)
    else:
        for key, value in data.items():
            setattr(row, key, value)

    if item.direction == Direction.OUTGOING:
        item.outgoing_status = OutgoingItemStatus.DISPATCHED
        series_result = await db.execute(select(Series).where(Series.id == item.series_id))
        series = series_result.scalar_one_or_none()
        if series:
            series.status = series.status

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="dispatch.updated",
        entity="dispatch_detail",
        entity_id=str(item_id),
        payload=data,
    )
    await db.commit()
    await db.refresh(row)
    await invalidate_response_cache(
        [f"series:get:{item.series_id}", f"series:items:{item.series_id}", "series:list:", "dashboard:", "reports:"]
    )
    return DispatchRead.model_validate(row)


@router.get("/item/{item_id}", response_model=DispatchRead | None)
async def get_dispatch(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DispatchRead | None:
    result = await db.execute(select(DispatchDetail).where(DispatchDetail.item_id == item_id))
    row = result.scalar_one_or_none()
    if not row:
        return None
    return DispatchRead.model_validate(row)
