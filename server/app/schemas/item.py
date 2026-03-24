from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import Direction, DispatchMode, IncomingItemStatus, ItemType, OutgoingItemStatus
from app.schemas.common import Timestamped, UUIDStr


class CorrespondenceItemCreate(BaseModel):
    direction: Direction
    item_type: ItemType
    subject: str = Field(min_length=3, max_length=255)

    sender_name: str | None = None
    sender_organization: str | None = None
    recipient_name: str | None = None
    recipient_organization: str | None = None
    recipient_address_email: str | None = None
    in_reference_to: str | None = None

    date_on_letter: datetime | None = None
    received_date: datetime | None = None
    sent_date: datetime | None = None

    mode: DispatchMode
    incoming_status: IncomingItemStatus | None = IncomingItemStatus.RECEIVED
    outgoing_status: OutgoingItemStatus | None = OutgoingItemStatus.DRAFT

    prompt_title: str | None = None
    prompt_text: str | None = None
    ai_draft_text: str | None = None
    final_draft_text: str | None = None
    remarks: str | None = None
    mode_specific_data: dict | None = None


class CorrespondenceItemUpdate(BaseModel):
    subject: str | None = None
    incoming_status: IncomingItemStatus | None = None
    outgoing_status: OutgoingItemStatus | None = None
    prompt_title: str | None = None
    prompt_text: str | None = None
    ai_draft_text: str | None = None
    final_draft_text: str | None = None
    remarks: str | None = None
    mode_specific_data: dict | None = None


class CorrespondenceItemRead(Timestamped):
    series_id: UUIDStr
    sequence_no: int
    direction: Direction
    item_type: ItemType
    diary_number: str | None = None
    letter_number: str | None = None
    subject: str
    sender_name: str | None = None
    sender_organization: str | None = None
    recipient_name: str | None = None
    recipient_organization: str | None = None
    recipient_address_email: str | None = None
    in_reference_to: str | None = None
    date_on_letter: datetime | None = None
    received_date: datetime | None = None
    sent_date: datetime | None = None
    mode: DispatchMode
    incoming_status: IncomingItemStatus | None = None
    outgoing_status: OutgoingItemStatus | None = None
    prompt_title: str | None = None
    prompt_text: str | None = None
    ai_draft_text: str | None = None
    final_draft_text: str | None = None
    remarks: str | None = None
    mode_specific_data: dict | None = None


class ItemListResponse(BaseModel):
    items: list[CorrespondenceItemRead]
    total: int
