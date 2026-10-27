from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
FRONTEND_DIR = ROOT_DIR / "frontend"
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"
MIGRATIONS_DIR = ROOT_DIR / "migrations"


class Settings(BaseSettings):
    """Runtime settings; every field maps to a ``PLANER_*`` env var."""

    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="PLANER_", extra="ignore"
    )

    database_url: str = "sqlite+aiosqlite:///./data/planer.db"
    admin_password: str = ""
    host: str = "127.0.0.1"
    port: int = 8000
    reload: bool = False
    log_level: str = "INFO"
    # Tests and throwaway demos create tables directly; the CLI uses
    # Alembic migrations instead.
    create_schema: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
