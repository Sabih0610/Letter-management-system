from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ApprovalDecision, ItemType, OutgoingItemStatus
from app.schemas.common import Timestamped, UUIDStr


class ApprovalSubmitRequest(BaseModel):
    item_id: UUIDStr
    submitted_to_user_id: UUIDStr
    comments: str | None = None


class ApprovalDecisionRequest(BaseModel):
    decision: ApprovalDecision
    comments: str | None = None
    sent_back_reason: str | None = None


class ApprovalRead(Timestamped):
    item_id: UUIDStr
    submitted_by_user_id: UUIDStr
    submitted_to_user_id: UUIDStr
    decision: ApprovalDecision
    comments: str | None = None
    sent_back_reason: str | None = None
    decided_at: datetime | None = None


class ApprovalQueueItem(BaseModel):
    approval_id: UUIDStr
    item_id: UUIDStr
    series_id: UUIDStr
    series_number: str
    series_subject: str
    organization_name: str
    sequence_no: int
    item_type: ItemType
    item_subject: str
    letter_number: str | None = None
    diary_number: str | None = None
    outgoing_status: OutgoingItemStatus | None = None
    submitted_at: datetime
    submitted_by_user_id: UUIDStr
    submitted_by_name: str | None = None
    comments: str | None = None
    current_decision: ApprovalDecision
    final_draft_excerpt: str | None = None
