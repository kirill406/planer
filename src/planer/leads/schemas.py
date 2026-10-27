from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from planer.leads.models import MAX_COMMENT_LEN, MAX_SESSION_LEN

Segment = Literal["personal", "adhd", "events", "meetings", "other"]
Tier = Literal["none", "free", "pro", "team"]


class LeadIn(BaseModel):
    email: EmailStr
    segment: Segment
    tier: Tier = "none"
    comment: str = Field(default="", max_length=MAX_COMMENT_LEN)
    session_id: str = Field(default="", max_length=MAX_SESSION_LEN)
    # Honeypot: hidden on the page, so only bots fill it.
    website: str = Field(default="", max_length=200)


class LeadOut(BaseModel):
    ok: bool
    created: bool
