import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ApprovalDecision


class Approval(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "approvals"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("correspondence_items.id"), nullable=False, index=True)
    submitted_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    submitted_to_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    decision: Mapped[ApprovalDecision] = mapped_column(Enum(ApprovalDecision, name="approval_decision_enum"), nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_back_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    item = relationship("CorrespondenceItem", back_populates="approvals")
