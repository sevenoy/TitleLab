# TitleLab Backend

Current phase: Phase 1 backend foundation.

This backend is intentionally minimal. It provides a FastAPI service skeleton,
public health/meta endpoints, SQLAlchemy model definitions, and an Alembic
schema migration file. It does not connect to production databases, run
migrations automatically, deploy, or implement business CRUD.

## Phase 1 Scope

- `GET /healthz`
- `GET /api/meta`
- SQLAlchemy model skeleton
- Alembic initial schema migration file
- Placeholder-only `.env.example`
- Minimal endpoint tests

## Phase 2A Scope

The first Phase 2 slice adds read-only content library APIs:

- `GET /api/v1/workspaces/{workspace_id}/contents`
- `GET /api/v1/workspaces/{workspace_id}/contents/{content_id}`
- `GET /api/v1/workspaces/{workspace_id}/categories`
- `GET /api/v1/workspaces/{workspace_id}/tags`

The contents list supports `content_type`, `category_id`, `tag_id`, `q`, `limit`,
and `offset`. These APIs are read-only and must keep every query scoped to the
requested `workspace_id`.

Out of scope for Phase 1:

- Content CRUD
- WeChat login
- Mini program pages
- Admin UI
- Import, snapshot restore, or AI generation logic
- Server, Nginx, DNS, deploy, or production database operations

## Phase 2B Contract And Local DB Smoke

Phase 2B verifies the Phase 2A read-only API contract and local empty-database
migration path. It does not add write routes or new product features.

Contract checks cover:

- OpenAPI only exposes the four allowed Phase 2A workspace `GET` routes.
- OpenAPI does not expose `POST`, `PUT`, `PATCH`, or `DELETE`.
- `ContentItemOut`, `CategoryOut`, and `TagOut` response fields stay stable.
- Existing read-only tests continue to validate workspace isolation.

Local migration smoke must use a local temporary SQLite database only:

```bash
cd backend
DATABASE_URL=sqlite:///./titlelab_phase2b_smoke_test.db uv run --no-project --with fastapi --with uvicorn --with sqlalchemy --with alembic --with pydantic-settings alembic upgrade head
DATABASE_URL=sqlite:///./titlelab_phase2b_smoke_test.db uv run --no-project --with fastapi --with uvicorn --with sqlalchemy --with alembic --with pydantic-settings alembic downgrade base
rm -f titlelab_phase2b_smoke_test.db
```

Never run these commands against production, remote, shared test, Tencent Cloud,
or Supabase databases.

## Local Setup

Use a local virtual environment or a temporary runner. Do not put real secrets
in `.env`, `.env.example`, docs, tests, or git history.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

## Run Locally

```bash
cd backend
uvicorn app.main:app --reload
```

Then check:

```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/api/meta
```

## Tests

```bash
python -m pytest
```

If dependencies are not installed locally, use a temporary `uv` run:

```bash
uv run --with fastapi --with uvicorn --with sqlalchemy --with alembic --with pydantic-settings --with pytest --with httpx python -m pytest
```

## Migration

The Phase 1 migration lives at:

```text
backend/alembic/versions/0001_phase1_core_schema.py
```

It defines the initial workspace-first schema only. Do not run `alembic upgrade`
against production. This phase does not apply migrations to any database.

## Release Gate

`release_ready` is hard-coded to `false` for Phase 1. Upload, review submission,
deployment, server configuration, and production database migration remain
blocked until an explicitly authorized release gate.
