import uuid

from sqlalchemy import ForeignKey, Text, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class DocumentText(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "document_texts"

    attachment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attachments.id"), nullable=False, index=True, unique=True)
    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("correspondence_items.id"), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    extraction_status: Mapped[str] = mapped_column(String(24), nullable=False, default="completed")
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    attachment = relationship("Attachment", back_populates="document_text")
    item = relationship("CorrespondenceItem", back_populates="document_texts")

