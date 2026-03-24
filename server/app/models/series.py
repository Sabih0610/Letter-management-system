import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import Direction, Priority, SeriesStatus


class Series(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "series"
    __table_args__ = (
        Index("ix_series_status_updated", "status", "updated_at"),
        Index("ix_series_due_date_status", "due_date", "status"),
        Index("ix_series_closed_at", "closed_at"),
    )

    series_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("categories.id"), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    started_with: Mapped[Direction] = mapped_column(Enum(Direction, name="direction_enum"), nullable=False)
    status: Mapped[SeriesStatus] = mapped_column(
        Enum(SeriesStatus, name="series_status_enum"),
        default=SeriesStatus.OPEN,
        index=True,
    )
    assigned_department_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("departments.id"), nullable=True, index=True)
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    priority: Mapped[Priority] = mapped_column(Enum(Priority, name="priority_enum"), default=Priority.MEDIUM)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    total_exchanges: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    latest_direction: Mapped[Direction | None] = mapped_column(Enum(Direction, name="latest_direction_enum"), nullable=True)
    latest_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("correspondence_items.id"), nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    category = relationship("Category", back_populates="series")
    assigned_department = relationship("Department", back_populates="series")
    assigned_user = relationship("User", back_populates="assigned_series")
    items = relationship("CorrespondenceItem", back_populates="series", foreign_keys="CorrespondenceItem.series_id")
