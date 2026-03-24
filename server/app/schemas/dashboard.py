from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_open_series: int
    total_pending_approval: int
    total_overdue: int
    total_awaiting_external_response: int
    total_drafts_in_progress: int
    recently_closed: int


class CategoryDashboardCard(BaseModel):
    category_id: str
    category_name: str
    open_series: int
    pending_draft: int
    pending_approval: int
    awaiting_external_response: int
    overdue_items: int
    closed_this_month: int


class ActivityEntry(BaseModel):
    action: str
    entity: str
    entity_id: str | None = None
    timestamp: str
    actor: str | None = None


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    categories: list[CategoryDashboardCard]
    recent_activity: list[ActivityEntry]


class AutomationSeriesCard(BaseModel):
    series_id: str
    series_number: str
    subject: str
    organization_name: str
    latest_incoming_item_id: str
    latest_incoming_subject: str
    updated_at: str
    due_date: str | None = None


class DashboardAutomationResponse(BaseModel):
    awaiting_reply_series: int
    pending_approval_items: int
    drafts_in_progress: int
    smart_reply_queue: list[AutomationSeriesCard]
