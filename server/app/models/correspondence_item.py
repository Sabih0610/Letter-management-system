import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import Direction, DispatchMode, IncomingItemStatus, ItemType, OutgoingItemStatus


class CorrespondenceItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "correspondence_items"
    __table_args__ = (
        Index("ix_items_series_sequence", "series_id", "sequence_no"),
        Index("ix_items_series_direction", "series_id", "direction"),
        Index("ix_items_outgoing_status", "outgoing_status"),
        Index("ix_items_incoming_status", "incoming_status"),
    )

    series_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("series.id"), nullable=False, index=True)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    direction: Mapped[Direction] = mapped_column(Enum(Direction, name="item_direction_enum"), nullable=False, index=True)
    item_type: Mapped[ItemType] = mapped_column(Enum(ItemType, name="item_type_enum"), nullable=False)

    diary_number: Mapped[str | None] = mapped_column(String(40), unique=True, nullable=True, index=True)
    letter_number: Mapped[str | None] = mapped_column(String(40), unique=True, nullable=True, index=True)

    subject: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sender_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    sender_organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    recipient_organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_address_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    in_reference_to: Mapped[str | None] = mapped_column(String(255), nullable=True)

    date_on_letter: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mode: Mapped[DispatchMode] = mapped_column(Enum(DispatchMode, name="dispatch_mode_enum"), nullable=False, index=True)
    incoming_status: Mapped[IncomingItemStatus | None] = mapped_column(
        Enum(IncomingItemStatus, name="incoming_item_status_enum"),
        nullable=True,
    )
    outgoing_status: Mapped[OutgoingItemStatus | None] = mapped_column(
        Enum(OutgoingItemStatus, name="outgoing_item_status_enum"),
        nullable=True,
    )

    prompt_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    prompt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_draft_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_draft_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    mode_specific_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    series = relationship("Series", back_populates="items", foreign_keys=[series_id])
    attachments = relationship("Attachment", back_populates="item")
    approvals = relationship("Approval", back_populates="item")
    dispatch_details = relationship("DispatchDetail", back_populates="item")
    document_texts = relationship("DocumentText", back_populates="item")
