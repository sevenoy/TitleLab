import pytest

from app.schemas import ErrorCode
from app.services.ai_openai_contract import (
    OpenAIContractError,
    build_structured_output_schema,
    normalize_openai_structured_response,
)


def test_structured_output_schema_requires_exact_suggestion_shape() -> None:
    schema = build_structured_output_schema(max_suggestions=3)
    inner = schema["json_schema"]["schema"]
    suggestion = inner["properties"]["suggestions"]["items"]

    assert schema["type"] == "json_schema"
    assert schema["json_schema"]["strict"] is True
    assert inner["additionalProperties"] is False
    assert inner["required"] == ["suggestions"]
    assert inner["properties"]["suggestions"]["maxItems"] == 3
    assert suggestion["additionalProperties"] is False
    assert suggestion["required"] == ["title", "rationale", "tags", "riskLevel", "score"]
    assert suggestion["properties"]["riskLevel"]["enum"] == ["low", "medium", "high"]


def test_structured_output_normalizer_accepts_only_valid_contract() -> None:
    suggestions = normalize_openai_structured_response(
        {
            "suggestions": [
                {
                    "title": "标题建议",
                    "rationale": "结构化输出，不能透传自由文本",
                    "tags": ["structured", "safe"],
                    "riskLevel": "low",
                    "score": 0.91,
                }
            ]
        }
    )

    assert suggestions[0].title == "标题建议"
    assert suggestions[0].score == 0.91


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"suggestions": []},
        {"suggestions": ["free text"]},
        {"suggestions": [{"title": "", "rationale": "ok", "tags": [], "riskLevel": "low", "score": 0.5}]},
        {"suggestions": [{"title": "ok", "rationale": "ok", "tags": [], "riskLevel": "unsafe", "score": 0.5}]},
        {"suggestions": [{"title": "ok", "rationale": "ok", "tags": [], "riskLevel": "low", "score": 2}]},
    ],
)
def test_structured_output_normalizer_rejects_schema_mismatch(payload: dict[str, object]) -> None:
    with pytest.raises(OpenAIContractError) as exc_info:
        normalize_openai_structured_response(payload)

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH
