# AGENTS.md — planer («Вовремя»)

## Commands
- Install: `uv sync` (Python 3.13 скачивается сам; Node.js 20+ нужен только для JS-тестов)
- Run (dev): `uv run planer` — применяет миграции и запускает сервер на http://127.0.0.1:8000
- Run (autoreload): `PLANER_RELOAD=true uv run planer`
- Install git hooks: `git config core.hooksPath scripts/hooks`
- Test (all): `uv run pytest` + `node --test tests/js/`
- Lint/format: `uv run ruff check --fix . && uv run ruff format .`
- New migration: `uv run alembic revision --autogenerate -m "<what>"`; apply: `uv run alembic upgrade head`
- Docker: `docker compose up --build` (SQLite в volume `planer-data`)

## Stack
- Python 3.13, FastAPI, Jinja2, SQLAlchemy 2 async, Alembic, pydantic-settings
- БД: SQLite (`aiosqlite`) по умолчанию; Postgres — `uv sync --extra postgres` и `PLANER_DATABASE_URL=postgresql+asyncpg://...`
- Frontend: чистый JS (ES-модули), без сборки и npm-зависимостей; CSS без фреймворков
- Хранение планов: `localStorage` браузера (MVP без аккаунтов); сервер хранит только заявки и анонимные события
- Тесты: pytest + httpx (API), `node --test` (движок `engine.js`)
- Линтер: ruff (line-length 79)

## Structure
- `src/planer/app.py` — фабрика `create_app()` и CLI `main()` (миграции + uvicorn)
- `src/planer/core/` — `config` (Settings, пути), `database` (engine, `get_session`), `logging`, `models` (реестр ORM-моделей для Alembic)
- `src/planer/<domain>/` — `models`, `schemas`, `service` (DAO), `router`: `leads/` (заявки), `analytics/` (события), `admin/` (воронка), `pages/` (HTML-страницы)
- `frontend/templates/` — Jinja: `landing.html`, `app.html`, `admin.html`, `base.html`
- `frontend/static/js/engine.js` — **чистый движок плана** (без DOM, без `Date.now()` внутри): расписание, сжатие, прогноз, итоги
- `frontend/static/js/` — `app.js` (UI-контроллер), `store.js` (localStorage), `clock.js` (часы и демо-ускорение), `notify.js` (уведомления, звук), `strings.js` (все тексты UI), `templates.js` (шаблоны планов), `track.js` (аналитика), `landing.js`, `sw.js`
- `migrations/` — Alembic (async, `render_as_batch` для SQLite)
- `specs/` — `spec.md` (общая спека), `plan.md` (дорожная карта), `SUMMARY.md` (регламент), `NNN-slug/`
- `docs/architecture.md` — архитектура и решения (единый источник правды)
- `scripts/hooks/` — git-хуки: `pre-commit` (ruff + pytest + node), `commit-msg` (Conventional Commits)

## Versioning (SemVer 2.0.0)
- Единственный источник версии — `pyproject.toml`; `planer.__version__` читает её из метаданных
- `0.y.z` — всё может меняться; `1.0.0` — первый стабильный публичный релиз
- Релиз: перенести `CHANGELOG.md [Unreleased]` под новую версию с датой, поднять версию в `pyproject.toml`, `git tag vX.Y.Z`
- Не поднимать версию в feature-ветках — только в release-коммитах

## Prohibitions (AI Must Never)
- Never Commit `.env`, базы `data/*.db` или реальные данные заявок
- Never Use `print()` — только `logging`; каждый вызов лога — f-строка
- Never Log email и другие персональные данные целиком (только домен/ID)
- Never Put `Date.now()`, DOM или `localStorage` в `engine.js` — время передаётся аргументом, так движок тестируется
- Never Hardcode русские строки в `app.js` — все тексты UI в `strings.js`
- Never Add env var без обновления `.env.example` (пустое или безопасное значение) и `core/config.py`
- Never Add npm-зависимости или сборщик фронтенда без согласования — MVP открывается без сборки
- Never Add событие аналитики без добавления в `EventName` (`analytics/schemas.py`) и в `docs/architecture.md`
- Never Change схему БД без миграции Alembic
- Never Skip tests before commit; never `--no-verify` без явного согласия
- Never Delete branches без явного согласия пользователя

## Architecture Decisions (детали: [docs/architecture.md](docs/architecture.md))
- Слои бэкенда: router → service (DAO) → models; router не ходит в БД напрямую
- `create_app(settings)` без глобального состояния: engine и sessionmaker живут в `app.state` — тесты поднимают изолированное приложение
- Логика плана целиком на клиенте: таймер должен работать офлайн и без сервера
- Расписание пересчитывается только при старте пункта; финиш плана фиксирован, начало раньше — запас копится, а не растягивает пункты
- Сжатие пропорционально только для пунктов без флага «фиксированный» и не глубже `maxCompression`; не хватает — честный прогноз опоздания и кнопка «Пропустить»
- Часы инъецируются (`clock.js`): демо-режим ускоряет время ×10/×60 для презентаций
- Схемы и потоки — mermaid-диаграммы рядом с текстом

## Testing
- Имена: Python `test_<module>_<scenario>_<expectation>`; JS `test('<function>: <scenario> → <expectation>')`
- Любая новая функция движка → тест в `tests/js/engine.test.mjs`
- Новый эндпоинт → тест в `tests/test_<domain>.py`
- Багфикс → регрессионный тест

## Planning & Specs (регламент: `specs/SUMMARY.md`)
- Фича: `specs/NNN-slug/spec.md` (что/зачем) + `plan.md` (как)
- Перед работой: прочитать `specs/spec.md`, `specs/plan.md`, `specs/SUMMARY.md`, взять Active
- После: перенести в Done одной фразой, обновить `CHANGELOG.md [Unreleased]`, знания — в `docs/` и `AGENTS.md`

## Workflow
- Упрощённый git-flow: `main` — только релизы (теги `vX.Y.Z`); `develop` — интеграция
- Ветки: `feat/<desc>`, `fix/<desc>`, `release/<ver>`, `hotfix/<desc>`; ответвляются от `develop` (hotfix — от `main`)
- Слияние: `git merge --no-ff` (видна топология веток, без squash)
- Коммиты: Conventional Commits `<type>(scope): <описание>`, type ∈ feat|fix|docs|style|refactor|test|chore|perf|build|ci; заголовок ≤ 72 символов; русский разрешён
- Рефакторинг отдельно от фич
- **После фичи: сверить README.md и docs/ с изменениями**

## User Interaction
- Тексты для пользователя: русский
- Комментарии в коде: английский предпочтителен, русский допустим
- Спеки, планы, этот файл: русский

## License
- Проприетарный проект: не добавлять файл лицензии без согласования
