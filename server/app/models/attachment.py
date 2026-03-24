import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Attachment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "attachments"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("correspondence_items.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attachment_type: Mapped[str | None] = mapped_column(String(64), nullable=True)

    item = relationship("CorrespondenceItem", back_populates="attachments")
    document_text = relationship("DocumentText", back_populates="attachment", uselist=False)
