from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.correspondence_item import CorrespondenceItem
from app.models.enums import Direction, OutgoingItemStatus, SeriesStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.item import CorrespondenceItemCreate, CorrespondenceItemRead, CorrespondenceItemUpdate, ItemListResponse
from app.services.audit import log_audit
from app.services.numbering import generate_diary_number, generate_letter_number
from app.services.response_cache import get_or_set_response, invalidate_response_cache

router = APIRouter(prefix="/series/{series_id}/items", tags=["items"])

SERIES_ITEMS_CACHE_TTL_SECONDS = 30


@router.get("", response_model=ItemListResponse)
async def list_series_items(
    series_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ItemListResponse:
    cache_key = f"series:items:{series_id}"

    async def _load() -> ItemListResponse:
        result = await db.execute(
            select(CorrespondenceItem)
            .where(CorrespondenceItem.series_id == series_id)
            .order_by(CorrespondenceItem.sequence_no.asc())
        )
        rows = result.scalars().all()
        return ItemListResponse(items=[CorrespondenceItemRead.model_validate(row) for row in rows], total=len(rows))

    return await get_or_set_response(cache_key, SERIES_ITEMS_CACHE_TTL_SECONDS, _load)


@router.post("", response_model=CorrespondenceItemRead, status_code=status.HTTP_201_CREATED)
async def add_series_item(
    series_id: str,
    payload: CorrespondenceItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CorrespondenceItemRead:
    series_result = await db.execute(select(Series).where(Series.id == series_id))
    series = series_result.scalar_one_or_none()
    if not series:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found.")
    if series.status == SeriesStatus.CLOSED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add item to a closed series.")

    sequence_result = await db.execute(
        select(func.max(CorrespondenceItem.sequence_no)).where(CorrespondenceItem.series_id == series_id)
    )
    current_max = sequence_result.scalar_one_or_none() or 0
    next_sequence = current_max + 1

    diary_number = None
    letter_number = None
    if payload.direction == Direction.INCOMING:
        diary_number = await generate_diary_number(db)
    else:
        letter_number = await generate_letter_number(db)

    item = CorrespondenceItem(
        series_id=series_id,
        sequence_no=next_sequence,
        diary_number=diary_number,
        letter_number=letter_number,
        **payload.model_dump(),
    )
    db.add(item)
    await db.flush()

    series.total_exchanges = next_sequence
    series.latest_direction = payload.direction
    series.latest_item_id = item.id
    if payload.direction == Direction.OUTGOING and payload.outgoing_status == OutgoingItemStatus.APPROVAL_PENDING:
        series.status = SeriesStatus.AWAITING_APPROVAL
    elif payload.direction == Direction.OUTGOING:
        series.status = SeriesStatus.AWAITING_INTERNAL_DRAFT
    else:
        series.status = SeriesStatus.OPEN

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="item.created",
        entity="correspondence_item",
        entity_id=str(item.id),
        description=f"Added {payload.direction} item #{next_sequence} in series {series.series_number}",
    )
    await db.commit()
    await db.refresh(item)
    await invalidate_response_cache([f"series:items:{series_id}", f"series:get:{series_id}", "series:list:", "dashboard:"])
    return CorrespondenceItemRead.model_validate(item)


@router.patch("/{item_id}", response_model=CorrespondenceItemRead)
async def update_series_item(
    series_id: str,
    item_id: str,
    payload: CorrespondenceItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CorrespondenceItemRead:
    result = await db.execute(
        select(CorrespondenceItem).where(and_(CorrespondenceItem.id == item_id, CorrespondenceItem.series_id == series_id))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found.")

    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(item, key, value)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="item.updated",
        entity="correspondence_item",
        entity_id=str(item.id),
        payload=data,
    )
    await db.commit()
    await db.refresh(item)
    await invalidate_response_cache([f"series:items:{series_id}", f"series:get:{series_id}", "series:list:", "dashboard:"])
    return CorrespondenceItemRead.model_validate(item)
