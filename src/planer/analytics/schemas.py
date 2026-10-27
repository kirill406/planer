from typing import Literal

from pydantic import BaseModel, Field, field_validator

from planer.leads.models import MAX_SESSION_LEN

EventName = Literal[
    "landing_view",
    "cta_click",
    "pricing_click",
    "lead_form_open",
    "app_open",
    "plan_created",
    "run_started",
    "run_finished",
    "suggestion_accepted",
]

MAX_PROPS = 10
MAX_PROP_LEN = 100

PropValue = str | int | float | bool


class EventIn(BaseModel):
    name: EventName
    session_id: str = Field(min_length=1, max_length=MAX_SESSION_LEN)
    props: dict[str, PropValue] = Field(default_factory=dict)

    @field_validator("props")
    @classmethod
    def limit_props(cls, props: dict[str, PropValue]) -> dict[str, PropValue]:
        if len(props) > MAX_PROPS:
            raise ValueError(f"не больше {MAX_PROPS} свойств")
        for key, value in props.items():
            if len(key) > MAX_PROP_LEN:
                raise ValueError("слишком длинное имя свойства")
            if isinstance(value, str) and len(value) > MAX_PROP_LEN:
                raise ValueError(f"слишком длинное значение: {key}")
        return props


class EventOut(BaseModel):
    ok: bool
