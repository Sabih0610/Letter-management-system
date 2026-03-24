from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import Direction, Priority, SeriesStatus
from app.schemas.common import Timestamped, UUIDStr


class SeriesCreate(BaseModel):
    category_id: UUIDStr
    subject: str = Field(min_length=3, max_length=255)
    organization_name: str
    started_with: Direction
    assigned_department_id: UUIDStr | None = None
    assigned_to_user_id: UUIDStr | None = None
    priority: Priority = Priority.MEDIUM
    due_date: datetime | None = None
    notes: str | None = None


class SeriesUpdate(BaseModel):
    status: SeriesStatus | None = None
    assigned_department_id: UUIDStr | None = None
    assigned_to_user_id: UUIDStr | None = None
    priority: Priority | None = None
    due_date: datetime | None = None
    notes: str | None = None


class SeriesRead(Timestamped):
    series_number: str
    category_id: UUIDStr
    subject: str
    organization_name: str
    started_with: Direction
    status: SeriesStatus
    assigned_department_id: UUIDStr | None = None
    assigned_to_user_id: UUIDStr | None = None
    priority: Priority
    opened_at: datetime
    closed_at: datetime | None = None
    total_exchanges: int
    latest_direction: Direction | None = None
    latest_item_id: UUIDStr | None = None
    due_date: datetime | None = None
    notes: str | None = None


class SeriesListResponse(BaseModel):
    items: list[SeriesRead]
    total: int
