from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.session import get_db
from app.deps.auth import AuthContext, build_metadata, require_workspace_member, resolve_current_user
from app.schemas import (
    AITitleSuggestionRequest,
    AITitleSuggestionsResponse,
    ErrorCode,
    ErrorResponse,
)
from app.services.ai_facade_service import AIFacadeConfig, AIFacadeError, generate_title_suggestions

router = APIRouter(
    prefix="/api/v1/workspaces/{workspace_id}/ai",
    tags=["ai"],
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)


@router.post("/title-suggestions", response_model=AITitleSuggestionsResponse)
def title_suggestions(
    payload: AITitleSuggestionRequest,
    request: Request,
    response: Response,
    workspace_id: str,
    db: Session = Depends(get_db),
    auth_context: AuthContext = Depends(resolve_current_user),
    settings: Settings = Depends(get_settings),
) -> AITitleSuggestionsResponse:
    require_workspace_member(db, workspace_id, auth_context)
    try:
        data = generate_title_suggestions(
            db=db,
            workspace_id=workspace_id,
            user_id=auth_context.user_id,
            request_payload=payload,
            config=AIFacadeConfig(
                provider=settings.titlelab_ai_provider.strip().lower(),
                real_provider_enabled=settings.titlelab_ai_real_provider_enabled,
            ),
        )
    except AIFacadeError as exc:
        status_code = 503 if exc.code.value.startswith("AI_PROVIDER") else 400
        raise HTTPException(status_code=status_code, detail=exc.code.value) from exc
    return AITitleSuggestionsResponse(code=ErrorCode.OK, message="OK", data=data, **build_metadata(request, response))
