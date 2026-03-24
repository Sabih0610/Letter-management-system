import uuid

from sqlalchemy import ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AIDraftLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_draft_logs"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("correspondence_items.id"), nullable=False, index=True)
    generated_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    prompt_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    prompt_instructions: Mapped[str] = mapped_column(Text, nullable=False)
    tone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    draft_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    context_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    context_preview: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    generated_text: Mapped[str] = mapped_column(Text, nullable=False)
