FROM python:3.13-slim
ENV TZ=Europe/Moscow \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/code/.venv/bin:$PATH" \
    PLANER_HOST=0.0.0.0 \
    PLANER_DATABASE_URL=sqlite+aiosqlite:////data/planer.db

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /bin/uv

WORKDIR /code
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY migrations migrations
COPY frontend frontend
COPY src src
RUN uv sync --frozen --no-dev

# Unprivileged user; /data holds the SQLite volume.
RUN useradd --system --uid 10001 planer \
    && mkdir -p /data \
    && chown planer /data
USER planer

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"
# Call the installed entry point directly: `uv run` would re-sync on start.
CMD ["planer"]
