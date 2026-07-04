from dataclasses import dataclass
from datetime import datetime

from fastapi import Depends, Header, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.core import User, WorkspaceMember
from app.schemas import response_metadata
from app.services.auth_service import SessionExpiredError, SessionInvalidError, SessionRevokedError, get_session_user


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    auth_mode: str = "dev_header"
    session_id: str | None = None
    session_expires_at: datetime | None = None


def build_metadata(request: Request, response: Response) -> dict[str, object]:
    metadata = response_metadata(request.headers.get("x-request-id"))
    response.headers["X-Request-Id"] = str(metadata["requestId"])
    return metadata


def resolve_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_titlelab_user_id: str | None = Header(default=None, alias="X-TitleLab-User-Id"),
) -> AuthContext:
    bearer_token = parse_bearer_token(authorization)
    if bearer_token:
        try:
            session, user = get_session_user(db, bearer_token)
        except SessionExpiredError:
            raise HTTPException(status_code=401, detail="session_expired") from None
        except SessionRevokedError:
            raise HTTPException(status_code=401, detail="session_revoked") from None
        except SessionInvalidError:
            raise HTTPException(status_code=401, detail="invalid_session") from None
        return AuthContext(
            user_id=user.id,
            auth_mode=session.auth_mode,
            session_id=session.id,
            session_expires_at=session.expires_at,
        )

    user_id = (x_titlelab_user_id or "").strip()
    if user_id and is_dev_header_allowed():
        return AuthContext(user_id=user_id)
    if user_id:
        raise HTTPException(status_code=401, detail="dev_header_disabled")
    if authorization:
        raise HTTPException(status_code=401, detail="invalid_authorization")
    raise HTTPException(status_code=401, detail="missing_user_context")


def parse_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def is_dev_header_allowed() -> bool:
    app_env = get_settings().app_env.lower()
    return app_env in {"local", "dev", "development", "test", "testing"}


def require_session_auth(auth_context: AuthContext) -> AuthContext:
    if not auth_context.session_id:
        raise HTTPException(status_code=401, detail="missing_user_context")
    return auth_context


def require_workspace_member(db: Session, workspace_id: str, auth_context: AuthContext) -> AuthContext:
    user_exists = db.scalar(
        select(User.id).where(
            User.id == auth_context.user_id,
            User.status == "active",
        )
    )
    if user_exists is None:
        raise HTTPException(status_code=403, detail="workspace_forbidden")

    member_exists = db.scalar(
        select(WorkspaceMember.id).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == auth_context.user_id,
        )
    )
    if member_exists is None:
        raise HTTPException(status_code=403, detail="workspace_forbidden")

    return auth_context
