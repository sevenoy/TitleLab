from dataclasses import dataclass

from fastapi import Header, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import User, WorkspaceMember
from app.schemas import response_metadata


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    auth_mode: str = "dev_header"


def build_metadata(request: Request, response: Response) -> dict[str, object]:
    metadata = response_metadata(request.headers.get("x-request-id"))
    response.headers["X-Request-Id"] = str(metadata["requestId"])
    return metadata


def resolve_current_user(
    x_titlelab_user_id: str | None = Header(default=None, alias="X-TitleLab-User-Id"),
) -> AuthContext:
    user_id = (x_titlelab_user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="missing_user_context")
    return AuthContext(user_id=user_id)


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
