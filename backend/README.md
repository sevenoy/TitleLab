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

## Phase 2C API Response Contract

Phase 2C wraps public meta and read-only content APIs in a stable response
envelope. It does not add write routes, login, database migrations, production
database access, deployment, or mini program code.

Successful responses use:

```json
{
  "code": "OK",
  "message": "OK",
  "data": {},
  "requestId": "client-or-server-generated-id",
  "serverTime": "2026-07-04T00:00:00Z",
  "version": "v1"
}
```

List responses put rows under `data.items` and include pagination metadata:

```json
{
  "data": {
    "items": [],
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

Phase 2C uses `hasMore` instead of `total` to avoid adding count queries in this
slice. `GET /api/v1/workspaces/{workspace_id}/contents` fetches one extra row to
compute `hasMore`; categories and tags return all active rows for the workspace
with `hasMore=false`.

Stable response codes are:

- `OK`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_PARAM`
- `INTERNAL_ERROR`

`requestId` is read from `X-Request-Id` when provided, otherwise the backend
generates one. The same value is returned in the response body and
`X-Request-Id` response header. `serverTime` is UTC ISO time and `version` is the
API contract version (`v1`).

`GET /healthz` intentionally remains a raw health probe response. It is the
only Phase 2C response-envelope exception so uptime checks can stay small and
stable.

Phase 3C mini program real read-only API integration should depend on this
envelope instead of consuming bare arrays or bare objects.

## Phase 4A Workspace Authorization Foundation

Phase 4A adds object-level workspace authorization to the four read-only
workspace APIs. It does not add production login, WeChat login, JWT/session
handling, write routes, database migrations, deployment, or mini program code.

The Phase 4A development/test auth context is passed with:

```text
X-TitleLab-User-Id: <user_id>
```

This header is only a temporary development/test mechanism so backend tests can
verify workspace membership. It is not a production authentication scheme and
must be replaced by formal WeChat login plus server-side session/JWT handling in
a later phase.

Authorization rules:

- Missing `X-TitleLab-User-Id` returns `401` with code `UNAUTHORIZED`.
- Unknown, disabled, or non-member users return `403` with code `FORBIDDEN`.
- Member users may read only the requested workspace through the existing
  `workspace_members.workspace_id + workspace_members.user_id` relationship.
- Missing content still returns `404` with code `NOT_FOUND`.
- `/healthz` remains a raw public health probe.
- `/api/meta` remains a public response envelope and does not require the
  development/test auth header.

Mini program real API gate should remain closed until a later gate provides a
real workspace id and formal authentication flow. The current `default`
workspace id placeholder is not sufficient for production traffic.

## Phase 4B Auth Session Foundation

Phase 4B adds the backend server-side session foundation for formal
authentication. It does not deploy, call WeChat online APIs, read a real
AppSecret, connect to a real database, or modify mini program code.

New auth tables:

- `auth_identities`: maps a provider identity such as WeChat `openid` to a
  TitleLab user with `unique(provider, provider_user_id)`.
- `user_sessions`: stores server-side sessions with `token_hash`, expiry,
  optional device/user-agent metadata, and optional revocation time.

Session token rules:

- Login returns the plaintext `accessToken` once.
- The database stores only `sha256` token hashes, never plaintext access tokens.
- Authenticated backend calls use `Authorization: Bearer <accessToken>`.
- `POST /api/v1/auth/logout` revokes only the current session.

Auth endpoints:

- `POST /api/v1/auth/wechat-login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`

WeChat code exchange is behind `app.services.wechat_auth_service.WeChatAuthService`.
The default implementation does not make network calls and returns a stable
`AUTH_CONFIG_ERROR` path until a later gate wires explicit production config.
Tests use dependency overrides to mock the code exchange.

Readonly workspace APIs now prefer `Authorization: Bearer <token>` and keep the
Phase 4A `workspace_members` authorization check. `X-TitleLab-User-Id` remains
available only as a local/dev/test fallback and is not a production login
scheme.

## Phase 4D Real Auth Preflight

Phase 4D adds a local static preflight harness for the mini program real API
and auth gates. It does not change backend auth implementation, deploy, call
WeChat online APIs, connect to a real database, run real database migrations, or
open production gates.

Run from the repository root:

```bash
python3 scripts/titlelab_phase4d_preflight_check.py
```

Backend requirements before any later real-login gate:

- `/healthz` stays public raw and does not expose sensitive settings.
- `/api/meta` stays public response-envelope output and does not expose secrets.
- Auth endpoints remain limited to `POST /api/v1/auth/wechat-login`,
  `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout`.
- WeChat code exchange must be mocked in tests unless a later release gate
  explicitly authorizes a real test environment.
- `X-TitleLab-User-Id` remains local/dev/test fallback only; production traffic
  must use server-side session auth.
- `realApiGateEnabled=false` and `authRealApiGateEnabled=false` remain the
  mini program defaults until a later controlled gate.

## Phase 4E Controlled Real Gate Readiness

Phase 4E keeps backend auth implementation unchanged and adds mini program
fail-fast readiness checks before any real API or auth request can be made.

Backend requirements for a future controlled real gate:

- Use a non-production test database only.
- Keep WeChat code exchange server-side; never put AppSecret in mini program
  files.
- Keep `/healthz` public raw and `/api/meta` public envelope.
- Keep readonly workspace APIs scoped by `workspace_members`.
- Keep auth POST limited to login/logout; do not add business write routes.
- Do not deploy or run real database migrations in Phase 4E.

## Phase 5A AI Facade Foundation

Phase 5A adds a backend-only AI Facade foundation. It does not call real OpenAI
services, read a real API key, deploy, run migrations, connect to a real
database, or modify mini program code.

New endpoint:

```text
POST /api/v1/workspaces/{workspace_id}/ai/title-suggestions
```

The endpoint requires `Authorization: Bearer <session>` or the existing
local/dev/test `X-TitleLab-User-Id` fallback, then verifies workspace membership
before generating title suggestions. Responses keep the Phase 2C envelope with
`requestId`, `serverTime`, and `version`.

Phase 5A AI config defaults:

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
OPENAI_API_KEY=
```

The mock provider returns deterministic structured suggestions with
`suggestions`, `provider`, `model`, `mock`, `usageEstimate`, and `warnings`.
Safety gates reject empty or oversized input, clamp excessive counts, warn on
unsupported locales, and avoid echoing secret-looking source text. Minimal
generation audit records are stored in the existing `ai_generation_records`
table; no new migration is added.

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

Phase 4B adds:

```text
backend/alembic/versions/0002_phase4b_auth_session_foundation.py
```

Use only local temporary SQLite files for migration dry-runs unless a later
release gate explicitly authorizes another database target. Do not run
`alembic upgrade` against production.

## Release Gate

`release_ready` is hard-coded to `false` for Phase 1. Upload, review submission,
deployment, server configuration, and production database migration remain
blocked until an explicitly authorized release gate.
