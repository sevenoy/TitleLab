from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ALLOWED_WORKSPACE_GET_PATHS = {
    "/api/v1/workspaces/{workspace_id}/contents",
    "/api/v1/workspaces/{workspace_id}/contents/{content_id}",
    "/api/v1/workspaces/{workspace_id}/categories",
    "/api/v1/workspaces/{workspace_id}/tags",
}

ALLOWED_WORKSPACE_POST_PATHS = {
    "/api/v1/workspaces/{workspace_id}/ai/title-suggestions",
}

CONTENT_ITEM_FIELDS = {
    "id",
    "workspace_id",
    "content_type",
    "text",
    "summary",
    "status",
    "primary_category_id",
    "account_category_id",
    "source",
    "sort_order",
    "is_deleted",
    "created_at",
    "updated_at",
}

CATEGORY_FIELDS = {
    "id",
    "workspace_id",
    "category_type",
    "name",
    "slug",
    "sort_order",
    "status",
    "created_at",
    "updated_at",
}

TAG_FIELDS = {
    "id",
    "workspace_id",
    "name",
    "tag_type",
    "status",
    "created_at",
    "updated_at",
}

API_RESPONSE_FIELDS = {"code", "message", "data", "requestId", "serverTime", "version"}
LIST_PAYLOAD_FIELDS = {"items", "limit", "offset", "hasMore"}
AI_TITLE_SUGGESTION_REQUEST_FIELDS = {
    "sourceText",
    "contentType",
    "tone",
    "platform",
    "count",
    "constraints",
    "referenceTitles",
    "locale",
}
AI_TITLE_SUGGESTION_FIELDS = {"title", "rationale", "tags", "riskLevel", "score"}
AI_TITLE_SUGGESTIONS_DATA_FIELDS = {
    "suggestions",
    "provider",
    "model",
    "mock",
    "usageEstimate",
    "warnings",
}
AI_USAGE_ESTIMATE_FIELDS = {
    "inputCharacters",
    "requestedCount",
    "returnedCount",
    "estimatedTokens",
    "estimatedInputTokens",
    "estimatedOutputTokens",
    "promptCachedTokens",
    "estimatedCostCents",
}
AI_WARNING_FIELDS = {"code", "message"}


def test_openapi_contains_only_phase2a_workspace_get_routes() -> None:
    openapi = app.openapi()
    workspace_paths = {path: methods for path, methods in openapi["paths"].items() if path in ALLOWED_WORKSPACE_GET_PATHS}

    assert set(workspace_paths) == ALLOWED_WORKSPACE_GET_PATHS
    assert all(set(methods) == {"get"} for methods in workspace_paths.values())


def test_openapi_contains_only_allowed_workspace_post_route() -> None:
    openapi = app.openapi()
    workspace_post_paths = {
        path
        for path, methods in openapi["paths"].items()
        if path.startswith("/api/v1/workspaces/") and "post" in methods
    }

    assert workspace_post_paths == ALLOWED_WORKSPACE_POST_PATHS


def test_openapi_does_not_expose_mutating_methods() -> None:
    openapi = app.openapi()
    forbidden_methods = {"post", "put", "patch", "delete"}
    allowed_mutating_operations = {
        "POST /api/v1/auth/wechat-login",
        "POST /api/v1/auth/logout",
        "POST /api/v1/workspaces/{workspace_id}/ai/title-suggestions",
    }
    mutating_operations = [
        f"{method.upper()} {path}"
        for path, methods in openapi["paths"].items()
        for method in methods
        if method in forbidden_methods
    ]

    assert set(mutating_operations) == allowed_mutating_operations
    assert not any(operation.startswith(("PUT ", "PATCH ", "DELETE ")) for operation in mutating_operations)


def test_openapi_response_schema_fields_are_stable() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert set(schemas["ContentItemOut"]["properties"]) == CONTENT_ITEM_FIELDS
    assert set(schemas["CategoryOut"]["properties"]) == CATEGORY_FIELDS
    assert set(schemas["TagOut"]["properties"]) == TAG_FIELDS
    assert set(schemas["ContentItemResponse"]["properties"]) == API_RESPONSE_FIELDS
    assert set(schemas["ContentItemListResponse"]["properties"]) == API_RESPONSE_FIELDS
    assert set(schemas["CategoryListResponse"]["properties"]) == API_RESPONSE_FIELDS
    assert set(schemas["TagListResponse"]["properties"]) == API_RESPONSE_FIELDS
    assert set(schemas["AITitleSuggestionRequest"]["properties"]) == AI_TITLE_SUGGESTION_REQUEST_FIELDS
    assert set(schemas["AITitleSuggestionOut"]["properties"]) == AI_TITLE_SUGGESTION_FIELDS
    assert set(schemas["AITitleSuggestionsData"]["properties"]) == AI_TITLE_SUGGESTIONS_DATA_FIELDS
    assert set(schemas["AIUsageEstimate"]["properties"]) == AI_USAGE_ESTIMATE_FIELDS
    assert set(schemas["AIWarning"]["properties"]) == AI_WARNING_FIELDS
    assert set(schemas["AITitleSuggestionsResponse"]["properties"]) == API_RESPONSE_FIELDS
    assert set(schemas["ContentItemListPayload"]["properties"]) == LIST_PAYLOAD_FIELDS
    assert set(schemas["CategoryListPayload"]["properties"]) == LIST_PAYLOAD_FIELDS
    assert set(schemas["TagListPayload"]["properties"]) == LIST_PAYLOAD_FIELDS
    assert set(schemas["ErrorResponse"]["properties"]) == API_RESPONSE_FIELDS | {"details"}


def test_phase2a_readonly_route_response_contracts() -> None:
    openapi = app.openapi()

    contents_response = openapi["paths"]["/api/v1/workspaces/{workspace_id}/contents"]["get"]["responses"]["200"]
    content_detail_response = openapi["paths"]["/api/v1/workspaces/{workspace_id}/contents/{content_id}"]["get"][
        "responses"
    ]["200"]
    categories_response = openapi["paths"]["/api/v1/workspaces/{workspace_id}/categories"]["get"]["responses"]["200"]
    tags_response = openapi["paths"]["/api/v1/workspaces/{workspace_id}/tags"]["get"]["responses"]["200"]

    assert contents_response["content"]["application/json"]["schema"]["$ref"].endswith("/ContentItemListResponse")
    assert content_detail_response["content"]["application/json"]["schema"]["$ref"].endswith("/ContentItemResponse")
    assert categories_response["content"]["application/json"]["schema"]["$ref"].endswith("/CategoryListResponse")
    assert tags_response["content"]["application/json"]["schema"]["$ref"].endswith("/TagListResponse")


def test_phase5a_ai_route_response_contract() -> None:
    openapi = app.openapi()

    ai_response = openapi["paths"]["/api/v1/workspaces/{workspace_id}/ai/title-suggestions"]["post"]["responses"][
        "200"
    ]

    assert ai_response["content"]["application/json"]["schema"]["$ref"].endswith("/AITitleSuggestionsResponse")
