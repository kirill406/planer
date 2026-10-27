from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from planer.analytics.schemas import EventIn, EventOut
from planer.analytics.service import EventDAO
from planer.core.database import get_session

router = APIRouter(prefix="/api/events", tags=["analytics"])


@router.post("", response_model=EventOut)
async def create_event(
    data: EventIn, session: AsyncSession = Depends(get_session)
) -> EventOut:
    await EventDAO.add_event(session, data)
    return EventOut(ok=True)
