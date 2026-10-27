"""Application bootstrap: FastAPI factory and the ``planer`` CLI."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from planer import __version__
from planer.admin.router import router as router_admin
from planer.analytics.router import router as router_events
from planer.core.config import (
    MIGRATIONS_DIR,
    ROOT_DIR,
    STATIC_DIR,
    Settings,
    get_settings,
)
from planer.core.database import (
    ensure_sqlite_dir,
    make_engine,
    make_session_maker,
)
from planer.core.logging import configure_logging
from planer.core.models import Base
from planer.leads.router import router as router_leads
from planer.pages.router import router as router_pages

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logger.info(f"Start planer {__version__}")
        if settings.create_schema:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.debug("Schema created via metadata.create_all")
        yield
        await engine.dispose()
        logger.info("Stop planer")

    app = FastAPI(
        title="Вовремя",
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.session_maker = make_session_maker(engine)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    app.include_router(router_pages)
    app.include_router(router_leads)
    app.include_router(router_events)
    app.include_router(router_admin)
    return app


def run_migrations(database_url: str) -> None:
    ensure_sqlite_dir(database_url)
    config = Config(str(ROOT_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
    logger.info("Database migrated to head")


def main() -> None:
    """CLI: apply migrations, then serve the app with uvicorn."""
    settings = get_settings()
    configure_logging(settings.log_level)
    run_migrations(settings.database_url)
    logger.info(f"Serving on http://{settings.host}:{settings.port}")
    uvicorn.run(
        "planer.app:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower(),
    )
