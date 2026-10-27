import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from planer.core.database import get_session
from planer.leads.schemas import LeadIn, LeadOut
from planer.leads.service import LeadDAO

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.post("", response_model=LeadOut)
async def create_lead(
    data: LeadIn, session: AsyncSession = Depends(get_session)
) -> LeadOut:
    if data.website:
        # Pretend success so bots do not retry.
        logger.warning("Lead rejected: honeypot field filled")
        return LeadOut(ok=True, created=False)
    created = await LeadDAO.add_lead(session, data)
    return LeadOut(ok=True, created=created)
