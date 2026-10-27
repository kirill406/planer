# Журнал изменений

Все заметные изменения в проекте документируются в этом файле.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено

- Каркас: FastAPI-приложение (`create_app`), CLI `planer` (миграции + uvicorn), настройки `PLANER_*`, SQLite по умолчанию и Postgres по `PLANER_DATABASE_URL`
- Заявки `POST /api/leads` (дедупликация по email, honeypot), события `POST /api/events` (белый список), админка `/admin` с воронкой и выгрузкой CSV
- Alembic-миграция `0001` (таблицы `leads`, `events`), Docker и docker-compose
- Документация: `AGENTS.md`, `specs/` (спека, дорожная карта, спеки 001–003), `docs/architecture.md`; git-хуки `pre-commit` и `commit-msg`
