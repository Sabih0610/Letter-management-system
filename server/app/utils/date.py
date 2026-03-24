from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def yyyymmdd(dt: datetime | None = None) -> str:
    dt = dt or utcnow()
    return dt.strftime("%Y%m%d")


def yyyy(dt: datetime | None = None) -> str:
    dt = dt or utcnow()
    return dt.strftime("%Y")

