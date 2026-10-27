from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from planer.core.database import Base

MAX_EMAIL_LEN = 254
MAX_COMMENT_LEN = 500
MAX_SESSION_LEN = 64


def utc_now() -> datetime:
    return datetime.now(UTC)


class Lead(Base):
    """Waitlist sign-up from the landing page."""

    __tablename__ = "leads"

    lead_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(
        String(MAX_EMAIL_LEN), unique=True, index=True
    )
    segment: Mapped[str] = mapped_column(String(32))
    tier: Mapped[str] = mapped_column(String(16), default="none")
    comment: Mapped[str] = mapped_column(String(MAX_COMMENT_LEN), default="")
    session_id: Mapped[str] = mapped_column(
        String(MAX_SESSION_LEN), default=""
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )

    def __repr__(self) -> str:
        return f"Lead(id={self.lead_id!r}, segment={self.segment!r})"
