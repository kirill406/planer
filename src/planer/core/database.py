from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import Request
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(AsyncAttrs, DeclarativeBase): ...


def ensure_sqlite_dir(database_url: str) -> None:
    """Create the parent folder of a file-based SQLite database."""
    url = make_url(database_url)
    if url.get_backend_name() == "sqlite" and url.database not in (
        None,
        "",
        ":memory:",
    ):
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)


def make_engine(database_url: str) -> AsyncEngine:
    ensure_sqlite_dir(database_url)
    return create_async_engine(database_url)


def make_session_maker(engine: AsyncEngine) -> async_sessionmaker:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    async with request.app.state.session_maker() as session:
        yield session
