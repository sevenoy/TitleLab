from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.meta import router as meta_router
from app.config import PHASE, PROJECT_NAME, SERVICE_NAME

app = FastAPI(
    title=PROJECT_NAME,
    description="TitleLab Phase 1 backend foundation",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(meta_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": "http_error",
            "message": str(exc.detail),
            "request_id": request.headers.get("x-request-id", ""),
            "details": None,
        },
    )


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": SERVICE_NAME,
        "phase": PHASE,
    }
