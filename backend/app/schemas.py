from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

API_VERSION = "v1"


class ErrorCode(str, Enum):
    OK = "OK"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    INVALID_PARAM = "INVALID_PARAM"
    INTERNAL_ERROR = "INTERNAL_ERROR"


def response_metadata(request_id: str | None = None) -> dict[str, object]:
    return {
        "requestId": request_id or uuid4().hex,
        "serverTime": datetime.now(timezone.utc),
        "version": API_VERSION,
    }


class ApiResponseBase(BaseModel):
    code: ErrorCode
    message: str
    requestId: str
    serverTime: datetime
    version: str


class ErrorResponse(ApiResponseBase):
    data: None = None
    details: dict[str, Any] | None = None


class ContentItemOut(BaseModel):
    id: str
    workspace_id: str
    content_type: str
    text: str
    summary: str | None
    status: str
    primary_category_id: str | None
    account_category_id: str | None
    source: str | None
    sort_order: int
    is_deleted: bool
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class CategoryOut(BaseModel):
    id: str
    workspace_id: str
    category_type: str
    name: str
    slug: str
    sort_order: int
    status: str
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TagOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    tag_type: str
    status: str
    created_at: datetime | None
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class MetaOut(BaseModel):
    service: str
    project: str
    phase: str
    api_base_domain: str
    api_base_url: str
    web_domain: str
    admin_domain: str
    app_env: str
    release_ready: bool


class ContentItemListPayload(BaseModel):
    items: list[ContentItemOut]
    limit: int
    offset: int
    hasMore: bool


class CategoryListPayload(BaseModel):
    items: list[CategoryOut]
    limit: int
    offset: int
    hasMore: bool


class TagListPayload(BaseModel):
    items: list[TagOut]
    limit: int
    offset: int
    hasMore: bool


class MetaResponse(ApiResponseBase):
    data: MetaOut


class ContentItemResponse(ApiResponseBase):
    data: ContentItemOut


class ContentItemListResponse(ApiResponseBase):
    data: ContentItemListPayload


class CategoryListResponse(ApiResponseBase):
    data: CategoryListPayload


class TagListResponse(ApiResponseBase):
    data: TagListPayload
