from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.core import Category, ContentItem, ContentTag, Tag, Workspace


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as session:
        seed_data(session)

    def override_get_db() -> Generator[Session, None, None]:
        with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


def seed_data(session: Session) -> None:
    session.add_all(
        [
            Workspace(id="workspace-a", name="Workspace A", slug="workspace-a"),
            Workspace(id="workspace-b", name="Workspace B", slug="workspace-b"),
            Category(
                id="category-a",
                workspace_id="workspace-a",
                category_type="title",
                name="标题",
                slug="title",
                sort_order=1,
            ),
            Category(
                id="category-b",
                workspace_id="workspace-b",
                category_type="title",
                name="隔离分类",
                slug="isolated",
                sort_order=1,
            ),
            Tag(id="tag-a", workspace_id="workspace-a", name="爆款", tag_type="scene"),
            Tag(id="tag-b", workspace_id="workspace-b", name="隔离标签", tag_type="scene"),
            ContentItem(
                id="content-title-a",
                workspace_id="workspace-a",
                content_type="title",
                text="夏日上新标题",
                summary="标题摘要",
                status="published",
                primary_category_id="category-a",
                sort_order=1,
            ),
            ContentItem(
                id="content-copy-a",
                workspace_id="workspace-a",
                content_type="copywriting",
                text="夏日上新文案",
                summary="文案摘要",
                status="published",
                primary_category_id="category-a",
                sort_order=2,
            ),
            ContentItem(
                id="content-title-b",
                workspace_id="workspace-b",
                content_type="title",
                text="其他 workspace 标题",
                status="published",
                primary_category_id="category-b",
                sort_order=1,
            ),
            ContentTag(
                id="content-tag-a",
                workspace_id="workspace-a",
                content_item_id="content-title-a",
                tag_id="tag-a",
            ),
        ]
    )
    session.commit()


def test_list_contents_success(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents")

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()}
    assert ids == {"content-title-a", "content-copy-a"}


def test_get_content_detail_success(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents/content-title-a")

    assert response.status_code == 200
    assert response.json()["text"] == "夏日上新标题"


def test_workspace_isolation_for_content_detail(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents/content-title-b")

    assert response.status_code == 404


def test_content_type_filter(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents?content_type=title")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["content-title-a"]


def test_category_and_tag_reading(client: TestClient) -> None:
    categories = client.get("/api/v1/workspaces/workspace-a/categories")
    tags = client.get("/api/v1/workspaces/workspace-a/tags")
    tagged_contents = client.get("/api/v1/workspaces/workspace-a/contents?tag_id=tag-a")

    assert categories.status_code == 200
    assert [item["id"] for item in categories.json()] == ["category-a"]
    assert tags.status_code == 200
    assert [item["id"] for item in tags.json()] == ["tag-a"]
    assert tagged_contents.status_code == 200
    assert [item["id"] for item in tagged_contents.json()] == ["content-title-a"]


def test_missing_content_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents/missing")

    assert response.status_code == 404
    assert response.json()["message"] == "content_not_found"


def test_no_mutating_phase_2a_workspace_routes() -> None:
    forbidden_methods = {"POST", "PUT", "PATCH", "DELETE"}
    mutating_routes = [
        (method, route.path)
        for route in app.routes
        if getattr(route, "path", "").startswith("/api/v1/workspaces/")
        for method in getattr(route, "methods", set())
        if method in forbidden_methods
    ]

    assert mutating_routes == []
