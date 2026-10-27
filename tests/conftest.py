from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from planer.app import create_app
from planer.core.config import Settings

ADMIN_PASSWORD = "test-admin"  # test value, not a real secret


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    db_path = (tmp_path / "test.db").as_posix()
    return Settings(
        database_url=f"sqlite+aiosqlite:///{db_path}",
        admin_password=ADMIN_PASSWORD,
        create_schema=True,
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def admin_auth() -> tuple[str, str]:
    return ("admin", ADMIN_PASSWORD)
