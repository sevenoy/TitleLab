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


def assert_success_envelope(data: dict[str, object], expected_request_id: str | None = None) -> None:
    assert data["code"] == "OK"
    assert data["message"] == "OK"
    assert isinstance(data["requestId"], str)
    assert data["requestId"]
    if expected_request_id:
        assert data["requestId"] == expected_request_id
    assert isinstance(data["serverTime"], str)
    assert data["version"] == "v1"
    assert "data" in data


def assert_list_payload(payload: dict[str, object]) -> list[dict[str, object]]:
    assert set(payload) == {"items", "limit", "offset", "hasMore"}
    assert isinstance(payload["items"], list)
    assert isinstance(payload["limit"], int)
    assert isinstance(payload["offset"], int)
    assert isinstance(payload["hasMore"], bool)
    return payload["items"]


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
    response = client.get("/api/v1/workspaces/workspace-a/contents", headers={"X-Request-Id": "list-request-id"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == "list-request-id"
    envelope = response.json()
    assert_success_envelope(envelope, expected_request_id="list-request-id")
    payload = envelope["data"]
    items = assert_list_payload(payload)
    assert payload["limit"] == 20
    assert payload["offset"] == 0
    assert payload["hasMore"] is False
    ids = {item["id"] for item in items}
    assert ids == {"content-title-a", "content-copy-a"}


def test_list_contents_has_more_with_limit(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents?limit=1&offset=0")

    assert response.status_code == 200
    envelope = response.json()
    assert_success_envelope(envelope)
    payload = envelope["data"]
    items = assert_list_payload(payload)
    assert len(items) == 1
    assert payload["limit"] == 1
    assert payload["offset"] == 0
    assert payload["hasMore"] is True


def test_get_content_detail_success(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents/content-title-a")

    assert response.status_code == 200
    envelope = response.json()
    assert_success_envelope(envelope)
    assert envelope["data"]["text"] == "夏日上新标题"


def test_workspace_isolation_for_content_detail(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents/content-title-b")

    assert response.status_code == 404


def test_content_type_filter(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents?content_type=title")

    assert response.status_code == 200
    envelope = response.json()
    assert_success_envelope(envelope)
    assert [item["id"] for item in assert_list_payload(envelope["data"])] == ["content-title-a"]


def test_category_and_tag_reading(client: TestClient) -> None:
    categories = client.get("/api/v1/workspaces/workspace-a/categories")
    tags = client.get("/api/v1/workspaces/workspace-a/tags")
    tagged_contents = client.get("/api/v1/workspaces/workspace-a/contents?tag_id=tag-a")

    assert categories.status_code == 200
    category_envelope = categories.json()
    assert_success_envelope(category_envelope)
    assert [item["id"] for item in assert_list_payload(category_envelope["data"])] == ["category-a"]
    assert tags.status_code == 200
    tag_envelope = tags.json()
    assert_success_envelope(tag_envelope)
    assert [item["id"] for item in assert_list_payload(tag_envelope["data"])] == ["tag-a"]
    assert tagged_contents.status_code == 200
    tagged_envelope = tagged_contents.json()
    assert_success_envelope(tagged_envelope)
    assert [item["id"] for item in assert_list_payload(tagged_envelope["data"])] == ["content-title-a"]


def test_missing_content_returns_404(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents/missing")

    assert response.status_code == 404
    data = response.json()
    assert data["code"] == "NOT_FOUND"
    assert data["message"] == "content_not_found"
    assert data["data"] is None
    assert isinstance(data["requestId"], str)
    assert isinstance(data["serverTime"], str)
    assert data["version"] == "v1"


def test_invalid_query_param_returns_stable_error_code(client: TestClient) -> None:
    response = client.get("/api/v1/workspaces/workspace-a/contents?limit=0")

    assert response.status_code == 422
    data = response.json()
    assert data["code"] == "INVALID_PARAM"
    assert data["message"] == "invalid_param"
    assert data["data"] is None
    assert isinstance(data["requestId"], str)
    assert isinstance(data["serverTime"], str)
    assert data["version"] == "v1"


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
