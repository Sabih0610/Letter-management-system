from datetime import date

from pydantic import BaseModel

from app.models.enums import Direction, DispatchMode, SeriesStatus


class SearchRequest(BaseModel):
    query: str | None = None
    direction: Direction | None = None
    from_date: date | None = None
    to_date: date | None = None
    status: SeriesStatus | None = None
    category_id: str | None = None
    dispatch_mode: DispatchMode | None = None
    courier_company: str | None = None
    pod_received: bool | None = None
    department_id: str | None = None
    assigned_to_user_id: str | None = None


class SearchHit(BaseModel):
    series_id: str
    series_number: str
    item_id: str | None = None
    diary_number: str | None = None
    letter_number: str | None = None
    subject: str
    organization_name: str
    direction: Direction | None = None
    tracking_number: str | None = None


class SearchResponse(BaseModel):
    total: int
    items: list[SearchHit]

