from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from planer.core.database import Base
from planer.leads.models import MAX_SESSION_LEN, utc_now


class Event(Base):
    """Anonymous product event: landing funnel and MVP usage."""

    __tablename__ = "events"

    event_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), index=True)
    session_id: Mapped[str] = mapped_column(String(MAX_SESSION_LEN))
    props: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    def __repr__(self) -> str:
        return f"Event(id={self.event_id!r}, name={self.name!r})"
