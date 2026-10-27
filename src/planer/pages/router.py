from datetime import UTC, datetime

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates

from planer import __version__
from planer.core.config import STATIC_DIR, TEMPLATES_DIR


def localtime(value: datetime) -> datetime:
    """Show DB timestamps in server local time; SQLite drops tzinfo."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone()


templates = Jinja2Templates(directory=TEMPLATES_DIR)
templates.env.globals["asset_version"] = __version__
templates.env.globals["app_version"] = __version__
templates.env.filters["localtime"] = localtime

router = APIRouter(tags=["pages"])


@router.get("/", response_class=HTMLResponse)
async def landing(request: Request):
    return templates.TemplateResponse(request, "landing.html")


@router.get("/app", response_class=HTMLResponse)
async def planner_app(request: Request):
    return templates.TemplateResponse(request, "app.html")


@router.get("/sw.js", include_in_schema=False)
async def service_worker() -> FileResponse:
    # Served from the root so the worker controls both / and /app.
    return FileResponse(
        STATIC_DIR / "js" / "sw.js",
        media_type="text/javascript",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/manifest.webmanifest", include_in_schema=False)
async def manifest() -> FileResponse:
    return FileResponse(
        STATIC_DIR / "manifest.webmanifest",
        media_type="application/manifest+json",
    )


@router.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}
