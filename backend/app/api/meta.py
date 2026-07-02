from fastapi import APIRouter, Depends

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

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/meta")
def meta(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    return {
        "service": SERVICE_NAME,
        "project": PROJECT_NAME,
        "phase": PHASE,
        "api_base_domain": API_BASE_DOMAIN,
        "api_base_url": settings.api_base_url,
        "web_domain": WEB_DOMAIN,
        "admin_domain": ADMIN_DOMAIN,
        "app_env": settings.app_env,
        "release_ready": RELEASE_READY,
    }
