from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.counter import Counter
from app.utils.date import yyyy, yyyymmdd


async def _next_counter(
    db: AsyncSession,
    *,
    counter_type: str,
    date_key: str,
    scope: str = "global",
) -> int:
    result = await db.execute(
        select(Counter).where(
            Counter.counter_type == counter_type,
            Counter.date_key == date_key,
            Counter.scope == scope,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        row = Counter(counter_type=counter_type, date_key=date_key, scope=scope, current_value=0)
        db.add(row)
        await db.flush()

    row.current_value += 1
    await db.flush()
    return row.current_value


async def generate_diary_number(db: AsyncSession, dt: datetime | None = None) -> str:
    date_key = yyyymmdd(dt)
    value = await _next_counter(db, counter_type="diary", date_key=date_key, scope="global")
    return f"DIA/{date_key}/{value:04d}"


async def generate_letter_number(db: AsyncSession, dt: datetime | None = None) -> str:
    date_key = yyyymmdd(dt)
    value = await _next_counter(db, counter_type="letter", date_key=date_key, scope="global")
    return f"CC/{date_key}/{value:02d}"


async def generate_series_number(db: AsyncSession, category_code: str, dt: datetime | None = None) -> str:
    year_key = yyyy(dt)
    scope = f"{category_code}-{year_key}"
    value = await _next_counter(db, counter_type="series", date_key=year_key, scope=scope)
    return f"SR-{category_code.upper()}-{year_key}-{value:03d}"

