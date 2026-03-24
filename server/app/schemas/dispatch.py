from pydantic import BaseModel, Field

from app.models.enums import DispatchMode
from app.schemas.common import Timestamped, UUIDStr


class DispatchUpsertRequest(BaseModel):
    mode: DispatchMode
    delivered_by: str | None = None
    received_by: str | None = None
    receiver_designation: str | None = None
    courier_company: str | None = None
    tracking_number: str | None = None
    pod_required: bool = False
    pod_received: bool = False
    sent_to_emails: list[str] | None = None
    cc_emails: list[str] | None = None
    bcc_emails: list[str] | None = None
    email_subject: str | None = None
    event_timestamp: str | None = None
    notes: str | None = None
    proof_files: list[str] | None = None


class DispatchRead(Timestamped):
    item_id: UUIDStr
    mode: DispatchMode
    delivered_by: str | None = None
    received_by: str | None = None
    receiver_designation: str | None = None
    courier_company: str | None = None
    tracking_number: str | None = None
    pod_required: bool
    pod_received: bool
    sent_to_emails: list[str] | None = Field(default=None)
    cc_emails: list[str] | None = Field(default=None)
    bcc_emails: list[str] | None = Field(default=None)
    email_subject: str | None = None
    event_timestamp: str | None = None
    notes: str | None = None
    proof_files: list[str] | None = Field(default=None)
