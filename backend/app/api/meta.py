from fastapi import APIRouter, Depends, Request, Response

from app.config import (
    ADMIN_DOMAIN,
    API_BASE_DOMAIN,
    PHASE,
    PROJECT_NAME,
    RELEASE_READY,
    SERVICE_NAME,
    WEB_DOMAIN,
    Settings,
    get_settings,
)
from app.schemas import ErrorCode, MetaOut, MetaResponse, response_metadata

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/meta", response_model=MetaResponse)
def meta(request: Request, response: Response, settings: Settings = Depends(get_settings)) -> MetaResponse:
    metadata = response_metadata(request.headers.get("x-request-id"))
    response.headers["X-Request-Id"] = str(metadata["requestId"])
    payload = MetaOut(
        service=SERVICE_NAME,
        project=PROJECT_NAME,
        phase=PHASE,
        api_base_domain=API_BASE_DOMAIN,
        api_base_url=settings.api_base_url,
        web_domain=WEB_DOMAIN,
        admin_domain=ADMIN_DOMAIN,
        app_env=settings.app_env,
        release_ready=RELEASE_READY,
    )
    return MetaResponse(code=ErrorCode.OK, message="OK", data=payload, **metadata)
