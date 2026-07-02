from fastapi import APIRouter

from app.config import PHASE, SERVICE_NAME

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz() -> dict[str, object]:
    return {
        "ok": True,
        "service": SERVICE_NAME,
        "phase": PHASE,
    }
