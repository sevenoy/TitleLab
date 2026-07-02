from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
