import csv
import io
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from planer.analytics.service import EventDAO
from planer.core.database import get_session
from planer.leads.service import LeadDAO
from planer.pages.router import templates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBasic(auto_error=False)

ADMIN_USER = "admin"
# Rows shown on the page; totals and conversions use COUNT(*) instead.
ADMIN_LEADS_LIMIT = 500
# Spreadsheet apps treat cells starting with these as formulas.
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def require_admin(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(security),
) -> None:
    password = request.app.state.settings.admin_password
    if not password:
        # Admin is disabled until PLANER_ADMIN_PASSWORD is set.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if credentials is None or not (
        secrets.compare_digest(credentials.username, ADMIN_USER)
        and secrets.compare_digest(credentials.password, password)
    ):
        logger.warning("Admin auth failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Basic"},
        )


def percent(part: int, whole: int) -> str:
    return f"{part / whole * 100:.1f}%" if whole else "—"


def csv_safe(value: str) -> str:
    """Neutralize CSV/formula injection from user-supplied text."""
    return f"'{value}" if value.startswith(FORMULA_PREFIXES) else value


@router.get("", response_class=HTMLResponse)
async def admin_page(
    request: Request,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin),
):
    events = await EventDAO.count_by_name(session)
    visitors = await EventDAO.unique_sessions(session, "landing_view")
    clickers = await EventDAO.unique_sessions(session, "pricing_click")
    app_users = await EventDAO.unique_sessions(session, "app_open")
    runners = await EventDAO.unique_sessions(session, "run_started")
    leads = await LeadDAO.list_leads(session, limit=ADMIN_LEADS_LIMIT)
    leads_total = await LeadDAO.count(session)
    funnel = [
        ("Уникальные посетители лендинга", visitors, ""),
        ("Нажали «Купить» в тарифах", clickers, percent(clickers, visitors)),
        ("Оставили заявку", leads_total, percent(leads_total, visitors)),
        ("Открыли приложение", app_users, ""),
        ("Запустили план", runners, percent(runners, app_users)),
    ]
    context = {
        "funnel": funnel,
        "events": events,
        "tiers": await EventDAO.count_prop(session, "pricing_click", "tier"),
        "starts": await EventDAO.count_prop(session, "run_started", "kind"),
        "segments": await LeadDAO.count_by(session, "segment"),
        "leads": leads,
        "leads_total": leads_total,
    }
    return templates.TemplateResponse(request, "admin.html", context)


@router.get("/leads.csv")
async def leads_csv(
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_admin),
) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["created_at", "email", "segment", "tier", "comment"])
    for lead in await LeadDAO.list_leads(session, limit=100_000):
        writer.writerow(
            [
                lead.created_at.isoformat(),
                csv_safe(lead.email),
                lead.segment,
                lead.tier,
                csv_safe(lead.comment),
            ]
        )
    return Response(
        # BOM lets Excel open UTF-8 Cyrillic correctly.
        content="﻿" + buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )
