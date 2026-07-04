from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import Category, ContentItem, ContentTag, Tag
from app.schemas import (
    CategoryListPayload,
    CategoryListResponse,
    CategoryOut,
    ContentItemListPayload,
    ContentItemListResponse,
    ContentItemOut,
    ContentItemResponse,
    ErrorCode,
    ErrorResponse,
    TagListPayload,
    TagListResponse,
    TagOut,
    response_metadata,
)

router = APIRouter(
    prefix="/api/v1/workspaces/{workspace_id}",
    tags=["readonly"],
    responses={
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)


def build_metadata(request: Request, response: Response) -> dict[str, object]:
    metadata = response_metadata(request.headers.get("x-request-id"))
    response.headers["X-Request-Id"] = str(metadata["requestId"])
    return metadata


@router.get("/contents", response_model=ContentItemListResponse)
def list_contents(
    request: Request,
    response: Response,
    workspace_id: str,
    content_type: str | None = None,
    category_id: str | None = None,
    tag_id: str | None = None,
    q: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> ContentItemListResponse:
    stmt = select(ContentItem).where(
        ContentItem.workspace_id == workspace_id,
        ContentItem.is_deleted.is_(False),
    )
    if content_type:
        stmt = stmt.where(ContentItem.content_type == content_type)
    if category_id:
        stmt = stmt.where(ContentItem.primary_category_id == category_id)
    if q:
        stmt = stmt.where(ContentItem.text.contains(q))
    if tag_id:
        stmt = stmt.join(ContentTag, ContentTag.content_item_id == ContentItem.id).where(
            ContentTag.workspace_id == workspace_id,
            ContentTag.tag_id == tag_id,
        )
    stmt = stmt.order_by(ContentItem.sort_order, ContentItem.created_at.desc()).offset(offset).limit(limit + 1)
    rows = list(db.scalars(stmt))
    items = [ContentItemOut.model_validate(item) for item in rows[:limit]]
    payload = ContentItemListPayload(items=items, limit=limit, offset=offset, hasMore=len(rows) > limit)
    return ContentItemListResponse(
        code=ErrorCode.OK,
        message="OK",
        data=payload,
        **build_metadata(request, response),
    )


@router.get("/contents/{content_id}", response_model=ContentItemResponse)
def get_content(
    request: Request,
    response: Response,
    workspace_id: str,
    content_id: str,
    db: Session = Depends(get_db),
) -> ContentItemResponse:
    item = db.scalar(
        select(ContentItem).where(
            ContentItem.workspace_id == workspace_id,
            ContentItem.id == content_id,
            ContentItem.is_deleted.is_(False),
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="content_not_found")
    return ContentItemResponse(
        code=ErrorCode.OK,
        message="OK",
        data=ContentItemOut.model_validate(item),
        **build_metadata(request, response),
    )


@router.get("/categories", response_model=CategoryListResponse)
def list_categories(
    request: Request,
    response: Response,
    workspace_id: str,
    db: Session = Depends(get_db),
) -> CategoryListResponse:
    stmt = (
        select(Category)
        .where(Category.workspace_id == workspace_id, Category.status == "active")
        .order_by(Category.sort_order, Category.name)
    )
    items = [CategoryOut.model_validate(item) for item in db.scalars(stmt)]
    payload = CategoryListPayload(items=items, limit=len(items), offset=0, hasMore=False)
    return CategoryListResponse(
        code=ErrorCode.OK,
        message="OK",
        data=payload,
        **build_metadata(request, response),
    )


@router.get("/tags", response_model=TagListResponse)
def list_tags(
    request: Request,
    response: Response,
    workspace_id: str,
    db: Session = Depends(get_db),
) -> TagListResponse:
    stmt = select(Tag).where(Tag.workspace_id == workspace_id, Tag.status == "active").order_by(Tag.name)
    items = [TagOut.model_validate(item) for item in db.scalars(stmt)]
    payload = TagListPayload(items=items, limit=len(items), offset=0, hasMore=False)
    return TagListResponse(
        code=ErrorCode.OK,
        message="OK",
        data=payload,
        **build_metadata(request, response),
    )
