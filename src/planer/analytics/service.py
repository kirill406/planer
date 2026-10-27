import json
import logging
from collections import Counter

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from planer.analytics.models import Event
from planer.analytics.schemas import EventIn

logger = logging.getLogger(__name__)


class EventDAO:  # Data Access Object
    @classmethod
    async def add_event(cls, session: AsyncSession, data: EventIn) -> None:
        event = Event(
            name=data.name,
            session_id=data.session_id,
            props=json.dumps(data.props, ensure_ascii=False),
        )
        session.add(event)
        await session.commit()
        logger.debug(f"Event stored: {data.name} props={data.props}")

    @classmethod
    async def count_by_name(cls, session: AsyncSession) -> dict[str, int]:
        query = select(Event.name, func.count()).group_by(Event.name)
        return {name: count for name, count in await session.execute(query)}

    @classmethod
    async def unique_sessions(cls, session: AsyncSession, name: str) -> int:
        query = select(func.count(distinct(Event.session_id))).filter_by(
            name=name
        )
        return (await session.execute(query)).scalar_one()

    @classmethod
    async def count_prop(
        cls, session: AsyncSession, name: str, prop: str
    ) -> dict[str, int]:
        """Count events ``name`` grouped by the value of ``props[prop]``."""
        query = select(Event.props).filter_by(name=name)
        counter: Counter[str] = Counter()
        for (raw,) in await session.execute(query):
            try:
                value = json.loads(raw).get(prop, "—")
            except json.JSONDecodeError as e:
                logger.error(f"Broken event props {raw!r}: {e}")
                continue
            counter[str(value)] += 1
        return dict(counter.most_common())
