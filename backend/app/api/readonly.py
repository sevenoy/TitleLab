from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.core import Category, ContentItem, ContentTag, Tag
from app.schemas import CategoryOut, ContentItemOut, TagOut

router = APIRouter(prefix="/api/v1/workspaces/{workspace_id}", tags=["readonly"])


@router.get("/contents", response_model=list[ContentItemOut])
def list_contents(
    workspace_id: str,
    content_type: str | None = None,
    category_id: str | None = None,
    tag_id: str | None = None,
    q: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[ContentItem]:
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
    stmt = stmt.order_by(ContentItem.sort_order, ContentItem.created_at.desc()).offset(offset).limit(limit)
    return list(db.scalars(stmt))


@router.get("/contents/{content_id}", response_model=ContentItemOut)
def get_content(workspace_id: str, content_id: str, db: Session = Depends(get_db)) -> ContentItem:
    item = db.scalar(
        select(ContentItem).where(
            ContentItem.workspace_id == workspace_id,
            ContentItem.id == content_id,
            ContentItem.is_deleted.is_(False),
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="content_not_found")
    return item


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(workspace_id: str, db: Session = Depends(get_db)) -> list[Category]:
    stmt = (
        select(Category)
        .where(Category.workspace_id == workspace_id, Category.status == "active")
        .order_by(Category.sort_order, Category.name)
    )
    return list(db.scalars(stmt))


@router.get("/tags", response_model=list[TagOut])
def list_tags(workspace_id: str, db: Session = Depends(get_db)) -> list[Tag]:
    stmt = select(Tag).where(Tag.workspace_id == workspace_id, Tag.status == "active").order_by(Tag.name)
    return list(db.scalars(stmt))
