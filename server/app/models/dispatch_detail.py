import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import DispatchMode


class DispatchDetail(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "dispatch_details"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("correspondence_items.id"), nullable=False, index=True)
    mode: Mapped[DispatchMode] = mapped_column(Enum(DispatchMode, name="dispatch_detail_mode_enum"), nullable=False)

    delivered_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    received_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    receiver_designation: Mapped[str | None] = mapped_column(String(120), nullable=True)

    courier_company: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    pod_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pod_received: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    sent_to_emails: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    cc_emails: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    bcc_emails: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    email_subject: Mapped[str | None] = mapped_column(String(255), nullable=True)

    event_timestamp: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    proof_files: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    item = relationship("CorrespondenceItem", back_populates="dispatch_details")
