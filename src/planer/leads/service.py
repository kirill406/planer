import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from planer.leads.models import Lead
from planer.leads.schemas import LeadIn

logger = logging.getLogger(__name__)


class LeadDAO:  # Data Access Object
    @classmethod
    async def add_lead(cls, session: AsyncSession, data: LeadIn) -> bool:
        """Save a lead; a repeated email updates it. Returns ``created``."""
        email = data.email.lower()
        domain = email.rsplit("@", maxsplit=1)[-1]
        query = select(Lead).filter_by(email=email)
        lead = (await session.execute(query)).scalar_one_or_none()
        if lead is not None:
            lead.segment = data.segment
            if data.tier != "none":
                lead.tier = data.tier
            if data.comment:
                lead.comment = data.comment
            await session.commit()
            logger.info(f"Lead updated: id={lead.lead_id}, domain={domain}")
            return False
        lead = Lead(
            email=email,
            segment=data.segment,
            tier=data.tier,
            comment=data.comment,
            session_id=data.session_id,
        )
        session.add(lead)
        await session.commit()
        logger.info(
            f"Lead created: id={lead.lead_id}, segment={data.segment}, "
            f"tier={data.tier}, domain={domain}"
        )
        return True

    @classmethod
    async def list_leads(
        cls, session: AsyncSession, limit: int = 500
    ) -> list[Lead]:
        query = select(Lead).order_by(Lead.created_at.desc()).limit(limit)
        return list((await session.execute(query)).scalars().all())

    @classmethod
    async def count(cls, session: AsyncSession) -> int:
        query = select(func.count()).select_from(Lead)
        return (await session.execute(query)).scalar_one()

    @classmethod
    async def count_by(
        cls, session: AsyncSession, column: str
    ) -> dict[str, int]:
        field = getattr(Lead, column)
        query = select(field, func.count()).group_by(field)
        rows = (await session.execute(query)).all()
        return {key: count for key, count in rows}
