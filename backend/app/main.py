from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.meta import router as meta_router
from app.api.readonly import router as readonly_router
from app.config import PHASE, PROJECT_NAME, SERVICE_NAME
from app.schemas import ErrorCode, ErrorResponse, response_metadata

app = FastAPI(
    title=PROJECT_NAME,
    description="TitleLab backend",
    version="0.1.0",
)

app.include_router(health_router)
app.include_router(meta_router)
app.include_router(auth_router)
app.include_router(readonly_router)
app.include_router(ai_router)


def error_response(request: Request, code: ErrorCode, message: str, status_code: int) -> JSONResponse:
    metadata = response_metadata(request.headers.get("x-request-id"))
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(code=code, message=message, **metadata).model_dump(mode="json"),
        headers={"X-Request-Id": str(metadata["requestId"])},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code_by_status = {
        401: ErrorCode.UNAUTHORIZED,
        403: ErrorCode.FORBIDDEN,
        404: ErrorCode.NOT_FOUND,
    }
    code_by_detail = {
        "auth_config_error": ErrorCode.AUTH_CONFIG_ERROR,
        "auth_provider_error": ErrorCode.AUTH_PROVIDER_ERROR,
        "session_expired": ErrorCode.SESSION_EXPIRED,
        "session_revoked": ErrorCode.SESSION_REVOKED,
        "AI_INPUT_TOO_LONG": ErrorCode.AI_INPUT_TOO_LONG,
        "AI_EMPTY_INPUT": ErrorCode.AI_EMPTY_INPUT,
        "AI_PROVIDER_DISABLED": ErrorCode.AI_PROVIDER_DISABLED,
        "AI_CONFIG_ERROR": ErrorCode.AI_CONFIG_ERROR,
        "AI_PROVIDER_ERROR": ErrorCode.AI_PROVIDER_ERROR,
        "AI_RATE_LIMITED": ErrorCode.AI_RATE_LIMITED,
    }
    code = code_by_detail.get(str(exc.detail), code_by_status.get(exc.status_code, ErrorCode.INTERNAL_ERROR))
    return error_response(request, code, str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return error_response(request, ErrorCode.INVALID_PARAM, "invalid_param", 422)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(request, ErrorCode.INTERNAL_ERROR, "internal_error", 500)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": SERVICE_NAME,
        "phase": PHASE,
    }
