from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import AuthIdentity, User, UserSession, Workspace, WorkspaceMember
from app.security.tokens import generate_session_token, hash_session_token
from app.services.wechat_auth_service import WeChatIdentity

DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7


class AuthServiceError(RuntimeError):
    pass


class SessionExpiredError(AuthServiceError):
    pass


class SessionRevokedError(AuthServiceError):
    pass


class SessionInvalidError(AuthServiceError):
    pass


class AuthUserForbiddenError(AuthServiceError):
    pass


@dataclass(frozen=True)
class LoginResult:
    access_token: str
    session: UserSession
    user: User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def find_or_create_user_for_wechat_identity(
    db: Session,
    identity: WeChatIdentity,
    now: datetime | None = None,
) -> User:
    current_time = now or utcnow()
    auth_identity = db.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == "wechat",
            AuthIdentity.provider_user_id == identity.openid,
        )
    )
    if auth_identity is not None:
        user = db.get(User, auth_identity.user_id)
        if user is None:
            raise SessionInvalidError("auth_identity_user_missing")
        if user.status != "active":
            raise AuthUserForbiddenError("user_forbidden")
        user.openid = user.openid or identity.openid
        user.unionid = user.unionid or identity.unionid
        user.last_login_at = current_time
        auth_identity.provider_union_id = identity.unionid or auth_identity.provider_union_id
        return user

    user = db.scalar(select(User).where(User.openid == identity.openid))
    if user is not None:
        if user.status != "active":
            raise AuthUserForbiddenError("user_forbidden")
        user.unionid = user.unionid or identity.unionid
        user.last_login_at = current_time
        db.add(
            AuthIdentity(
                id=uuid4().hex,
                user_id=user.id,
                provider="wechat",
                provider_user_id=identity.openid,
                provider_union_id=identity.unionid,
            )
        )
        return user

    user = User(
        id=uuid4().hex,
        openid=identity.openid,
        unionid=identity.unionid,
        display_name="TitleLab User",
        status="active",
        last_login_at=current_time,
    )
    db.add(user)
    db.add(
        AuthIdentity(
            id=uuid4().hex,
            user_id=user.id,
            provider="wechat",
            provider_user_id=identity.openid,
            provider_union_id=identity.unionid,
        )
    )
    return user


def create_session(
    db: Session,
    user: User,
    ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS,
    device_label: str | None = None,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> LoginResult:
    current_time = now or utcnow()
    token = generate_session_token()
    session = UserSession(
        id=uuid4().hex,
        user_id=user.id,
        token_hash=hash_session_token(token),
        auth_mode="wechat_session",
        device_label=device_label,
        user_agent=user_agent,
        created_at=current_time,
        expires_at=current_time + timedelta(seconds=ttl_seconds),
    )
    db.add(session)
    return LoginResult(access_token=token, session=session, user=user)


def login_with_wechat_identity(
    db: Session,
    identity: WeChatIdentity,
    ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS,
    device_label: str | None = None,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> LoginResult:
    user = find_or_create_user_for_wechat_identity(db, identity, now=now)
    result = create_session(
        db,
        user,
        ttl_seconds=ttl_seconds,
        device_label=device_label,
        user_agent=user_agent,
        now=now,
    )
    db.commit()
    db.refresh(result.user)
    db.refresh(result.session)
    return result


def get_session_user(db: Session, token: str, now: datetime | None = None) -> tuple[UserSession, User]:
    token_hash = hash_session_token(token)
    session = db.scalar(select(UserSession).where(UserSession.token_hash == token_hash))
    if session is None:
        raise SessionInvalidError("invalid_session")
    if session.revoked_at is not None:
        raise SessionRevokedError("session_revoked")
    current_time = now or utcnow()
    if normalize_datetime(session.expires_at) <= current_time:
        raise SessionExpiredError("session_expired")
    user = db.scalar(select(User).where(User.id == session.user_id, User.status == "active"))
    if user is None:
        raise SessionInvalidError("invalid_session_user")
    session.last_seen_at = current_time
    db.commit()
    db.refresh(session)
    return session, user


def revoke_session(db: Session, session: UserSession, now: datetime | None = None) -> None:
    session.revoked_at = now or utcnow()
    db.commit()


def list_user_workspaces(db: Session, user_id: str) -> list[tuple[Workspace, WorkspaceMember]]:
    stmt = (
        select(Workspace, WorkspaceMember)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            WorkspaceMember.user_id == user_id,
            Workspace.status == "active",
        )
        .order_by(Workspace.name)
    )
    return list(db.execute(stmt).all())
