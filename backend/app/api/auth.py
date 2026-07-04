from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.deps.auth import AuthContext, build_metadata, require_session_auth, resolve_current_user
from app.models.core import User, UserSession
from app.schemas import (
    AuthLoginOut,
    AuthLoginRequest,
    AuthLoginResponse,
    AuthLogoutOut,
    AuthLogoutResponse,
    AuthMeOut,
    AuthMeResponse,
    ErrorCode,
    ErrorResponse,
    UserOut,
    WorkspaceOut,
)
from app.services.auth_service import AuthUserForbiddenError, list_user_workspaces, login_with_wechat_identity, revoke_session
from app.services.wechat_auth_service import (
    WeChatAuthConfigError,
    WeChatAuthProviderError,
    WeChatAuthService,
    get_wechat_auth_service,
)

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"],
    responses={
        401: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)


def membership_payload(db: Session, user_id: str) -> list[WorkspaceOut]:
    return [
        WorkspaceOut(id=workspace.id, name=workspace.name, slug=workspace.slug, role=member.role)
        for workspace, member in list_user_workspaces(db, user_id)
    ]


@router.post("/wechat-login", response_model=AuthLoginResponse)
def wechat_login(
    payload: AuthLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    wechat_auth_service: WeChatAuthService = Depends(get_wechat_auth_service),
) -> AuthLoginResponse:
    try:
        identity = wechat_auth_service.exchange_code_for_wechat_identity(payload.code.strip())
    except WeChatAuthConfigError:
        raise HTTPException(status_code=503, detail="auth_config_error") from None
    except WeChatAuthProviderError:
        raise HTTPException(status_code=502, detail="auth_provider_error") from None

    try:
        login_result = login_with_wechat_identity(
            db,
            identity,
            ttl_seconds=get_settings().titlelab_session_ttl_seconds,
            device_label=payload.deviceLabel,
            user_agent=request.headers.get("user-agent"),
        )
    except AuthUserForbiddenError:
        raise HTTPException(status_code=403, detail="user_forbidden") from None
    data = AuthLoginOut(
        accessToken=login_result.access_token,
        expiresAt=login_result.session.expires_at,
        user=UserOut.model_validate(login_result.user),
        memberships=membership_payload(db, login_result.user.id),
    )
    return AuthLoginResponse(code=ErrorCode.OK, message="OK", data=data, **build_metadata(request, response))


@router.get("/me", response_model=AuthMeResponse)
def get_me(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    auth_context: AuthContext = Depends(resolve_current_user),
) -> AuthMeResponse:
    user_model = db.get(User, auth_context.user_id)
    if user_model is None:
        raise HTTPException(status_code=401, detail="invalid_session")
    data = AuthMeOut(
        user=UserOut.model_validate(user_model),
        memberships=membership_payload(db, auth_context.user_id),
        sessionExpiresAt=auth_context.session_expires_at,
    )
    return AuthMeResponse(code=ErrorCode.OK, message="OK", data=data, **build_metadata(request, response))


@router.post("/logout", response_model=AuthLogoutResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    auth_context: AuthContext = Depends(resolve_current_user),
) -> AuthLogoutResponse:
    require_session_auth(auth_context)
    session = db.get(UserSession, auth_context.session_id)
    if session is None:
        raise HTTPException(status_code=401, detail="invalid_session")
    revoke_session(db, session)
    data = AuthLogoutOut(revoked=True)
    return AuthLogoutResponse(code=ErrorCode.OK, message="OK", data=data, **build_metadata(request, response))
