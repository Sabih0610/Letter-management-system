from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import SeriesStatus
from app.models.series import Series
from app.models.user import User
from app.schemas.common import Message
from app.schemas.series import SeriesCreate, SeriesListResponse, SeriesRead, SeriesUpdate
from app.services.audit import log_audit
from app.services.numbering import generate_series_number
from app.services.response_cache import get_or_set_response, invalidate_response_cache

router = APIRouter(prefix="/series", tags=["series"])

SERIES_LIST_CACHE_TTL_SECONDS = 30
SERIES_DETAIL_CACHE_TTL_SECONDS = 30


def _cache_part(value: object | None) -> str:
    return str(value) if value is not None else ""


@router.get("", response_model=SeriesListResponse)
async def list_series(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
    status_filter: SeriesStatus | None = Query(default=None, alias="status"),
    category_id: str | None = None,
    assigned_to_user_id: str | None = None,
    query: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> SeriesListResponse:
    cache_key = (
        f"series:list:status={_cache_part(status_filter)}:"
        f"category={_cache_part(category_id)}:"
        f"assigned={_cache_part(assigned_to_user_id)}:"
        f"query={_cache_part(query)}:"
        f"limit={limit}:offset={offset}"
    )

    async def _load() -> SeriesListResponse:
        filters = []
        if status_filter:
            filters.append(Series.status == status_filter)
        if category_id:
            filters.append(Series.category_id == category_id)
        if assigned_to_user_id:
            filters.append(Series.assigned_to_user_id == assigned_to_user_id)
        if query:
            filters.append(
                or_(
                    Series.series_number.ilike(f"%{query}%"),
                    Series.subject.ilike(f"%{query}%"),
                    Series.organization_name.ilike(f"%{query}%"),
                )
            )

        statement = select(Series).order_by(Series.updated_at.desc()).offset(offset).limit(limit)
        count_statement = select(func.count(Series.id))
        if filters:
            where_clause = and_(*filters)
            statement = statement.where(where_clause)
            count_statement = count_statement.where(where_clause)

        total = (await db.scalar(count_statement)) or 0
        result = await db.execute(statement)
        rows = result.scalars().all()
        return SeriesListResponse(items=[SeriesRead.model_validate(row) for row in rows], total=int(total))

    return await get_or_set_response(cache_key, SERIES_LIST_CACHE_TTL_SECONDS, _load)


@router.post("", response_model=SeriesRead, status_code=status.HTTP_201_CREATED)
async def create_series(
    payload: SeriesCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SeriesRead:
    category_result = await db.execute(select(Category).where(Category.id == payload.category_id))
    category = category_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    series_number = await generate_series_number(db, category.code)
    row = Series(
        series_number=series_number,
        category_id=payload.category_id,
        subject=payload.subject,
        organization_name=payload.organization_name,
        started_with=payload.started_with,
        assigned_department_id=payload.assigned_department_id,
        assigned_to_user_id=payload.assigned_to_user_id,
        priority=payload.priority,
        status=SeriesStatus.OPEN,
        opened_at=datetime.now(timezone.utc),
        due_date=payload.due_date,
        notes=payload.notes,
    )
    db.add(row)
    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="series.created",
        entity="series",
        entity_id=str(row.id),
        description=f"Series {series_number} created",
    )
    await db.commit()
    await db.refresh(row)
    await invalidate_response_cache(["series:list:", "dashboard:", "reports:"])
    return SeriesRead.model_validate(row)


@router.get("/stats/count-by-status")
async def count_by_status(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    result = await db.execute(select(Series.status, func.count(Series.id)).group_by(Series.status))
    return {str(status): count for status, count in result.all()}


@router.patch("/{series_id}", response_model=SeriesRead)
async def update_series(
    series_id: str,
    payload: SeriesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SeriesRead:
    result = await db.execute(select(Series).where(Series.id == series_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found.")

    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(row, key, value)
    if payload.status == SeriesStatus.CLOSED:
        row.closed_at = datetime.now(timezone.utc)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="series.updated",
        entity="series",
        entity_id=str(row.id),
        payload=data,
    )
    await db.commit()
    await db.refresh(row)
    await invalidate_response_cache(
        [f"series:get:{series_id}", f"series:items:{series_id}", "series:list:", "dashboard:", "reports:"]
    )
    return SeriesRead.model_validate(row)


@router.post("/{series_id}/close", response_model=Message)
async def close_series(
    series_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    result = await db.execute(select(Series).where(Series.id == series_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found.")

    row.status = SeriesStatus.CLOSED
    row.closed_at = datetime.now(timezone.utc)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        action="series.closed",
        entity="series",
        entity_id=str(row.id),
        description=f"Series {row.series_number} closed",
    )
    await db.commit()
    await invalidate_response_cache(
        [f"series:get:{series_id}", f"series:items:{series_id}", "series:list:", "dashboard:", "reports:"]
    )
    return Message(message="Series closed successfully.")


@router.get("/{series_id}", response_model=SeriesRead)
async def get_series(
    series_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SeriesRead:
    cache_key = f"series:get:{series_id}"

    async def _load() -> SeriesRead:
        result = await db.execute(select(Series).where(Series.id == series_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found.")
        return SeriesRead.model_validate(row)

    return await get_or_set_response(cache_key, SERIES_DETAIL_CACHE_TTL_SECONDS, _load)
