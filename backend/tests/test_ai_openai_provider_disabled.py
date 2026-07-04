from pathlib import Path

import pytest

from app.config import Settings
from app.schemas import ErrorCode
from app.services.ai_openai_provider import OpenAIProviderPlaceholder, normalize_structured_suggestions
from app.services.ai_provider_gate import AIProviderGateError, validate_ai_provider_readiness
from app.services.ai_safety import sanitize_title_suggestion_request


def test_openai_placeholder_has_no_runtime_endpoint_marker() -> None:
    marker = "api." + "openai" + ".com"
    source = Path(__file__).parents[1] / "app" / "services" / "ai_openai_provider.py"

    assert marker not in source.read_text(encoding="utf-8").lower()


def test_openai_placeholder_generate_is_disabled_even_when_readiness_exists() -> None:
    readiness = validate_ai_provider_readiness(
        Settings(
            titlelab_ai_provider="openai",
            titlelab_ai_real_provider_enabled=True,
            titlelab_ai_model="gpt-placeholder",
        ),
        api_key_present=True,
    )
    provider = OpenAIProviderPlaceholder(readiness)
    payload = sanitize_title_suggestion_request(
        source_text="为测试写标题",
        content_type="title",
        tone="clear",
        platform="wechat",
        count=1,
        constraints=[],
        reference_titles=[],
        locale="zh-CN",
    )

    with pytest.raises(AIProviderGateError) as exc_info:
        provider.generate_title_suggestions(payload, "prompt")

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_DISABLED


def test_structured_output_normalization_is_strict_and_bounded() -> None:
    suggestions = normalize_structured_suggestions(
        {
            "suggestions": [
                {
                    "title": "A" * 100,
                    "rationale": "B" * 260,
                    "tags": ["tag1", "tag2"],
                    "riskLevel": "unexpected",
                    "score": 1.5,
                }
            ]
        }
    )

    assert len(suggestions) == 1
    assert len(suggestions[0].title) == 80
    assert len(suggestions[0].rationale) == 200
    assert suggestions[0].riskLevel == "medium"
    assert suggestions[0].score == 1.0
