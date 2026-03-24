from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Counter(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "counters"
    __table_args__ = (UniqueConstraint("counter_type", "date_key", "scope", name="uq_counter_type_date_scope"),)

    counter_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    date_key: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(String(80), nullable=False, default="global", index=True)
    current_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

