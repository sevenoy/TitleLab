import os

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import AiGenerationRecord, User, Workspace, WorkspaceMember
from app.schemas import AITitleSuggestionRequest, ErrorCode
from app.services.ai_budget import build_budget_policy
from app.services.ai_facade_service import AIFacadeConfig, AIFacadeError, generate_title_suggestions
from app.services.ai_openai_contract import (
    FakeOpenAITransport,
    OpenAIContractError,
    build_openai_title_suggestion_request,
    build_prompt_cache_friendly_messages,
    map_openai_error,
    normalize_openai_structured_response,
    redact_openai_audit_payload,
    run_openai_dryrun_contract,
)
from app.services.ai_provider_gate import AIProviderReadiness
from app.services.ai_safety import sanitize_title_suggestion_request


def sanitized_payload(**overrides: object):
    values: dict[str, object] = {
        "source_text": "帮我为新品内容生成小红书标题，强调真实场景和收藏价值",
        "content_type": "title",
        "tone": "clear",
        "platform": "xiaohongshu",
        "count": 2,
        "constraints": ["不要夸张承诺"],
        "reference_titles": ["夏日新品这样写更容易被收藏"],
        "locale": "zh-CN",
    }
    values.update(overrides)
    return sanitize_title_suggestion_request(**values)


def openai_request(**overrides: object):
    values = {
        "payload": sanitized_payload(),
        "model": "gpt-placeholder",
        "timeout_seconds": 15,
        "max_retries": 1,
        "prompt_cache_key_prefix": "titlelab-test",
        "request_id": "phase5c-request-id",
    }
    values.update(overrides)
    return build_openai_title_suggestion_request(**values)


def test_fake_transport_success_never_uses_external_request_path() -> None:
    transport = FakeOpenAITransport()
    request = openai_request()

    result = run_openai_dryrun_contract(request, transport)

    assert len(result.suggestions) == 2
    assert result.suggestions[0].riskLevel == "low"
    assert result.provider_request_id == "fake-openai-phase5c-request-id"
    assert result.usage.input_tokens == 120
    assert result.usage.output_tokens == 60
    assert result.usage.prompt_cached_tokens == 40
    assert transport.calls == [request]


def test_malformed_response_maps_to_bad_response() -> None:
    with pytest.raises(OpenAIContractError) as exc_info:
        run_openai_dryrun_contract(openai_request(), FakeOpenAITransport("malformed_json"))

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_BAD_RESPONSE


def test_schema_mismatch_maps_to_schema_mismatch() -> None:
    with pytest.raises(OpenAIContractError) as exc_info:
        run_openai_dryrun_contract(openai_request(), FakeOpenAITransport("schema_mismatch"))

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH


def test_rate_limit_timeout_and_provider_error_mapping() -> None:
    scenarios = {
        "rate_limit": ErrorCode.AI_PROVIDER_RATE_LIMITED,
        "timeout": ErrorCode.AI_PROVIDER_TIMEOUT,
        "provider_error": ErrorCode.AI_PROVIDER_ERROR,
    }

    for scenario, expected_code in scenarios.items():
        with pytest.raises(OpenAIContractError) as exc_info:
            run_openai_dryrun_contract(openai_request(), FakeOpenAITransport(scenario))
        assert exc_info.value.code == expected_code

    assert map_openai_error("429 rate limited") == ErrorCode.AI_PROVIDER_RATE_LIMITED
    assert map_openai_error("request timeout") == ErrorCode.AI_PROVIDER_TIMEOUT


def test_prompt_cache_friendly_messages_keep_static_prefix_before_dynamic_input() -> None:
    payload = sanitized_payload(source_text="Bearer sample-sensitive-value should be redacted")

    messages = build_prompt_cache_friendly_messages(payload, prompt_cache_key_prefix="phase5c")

    assert [message["role"] for message in messages.messages] == ["system", "user"]
    assert "sourceText=" not in messages.messages[0]["content"]
    assert "sourceText=" in messages.messages[1]["content"]
    assert "sample-sensitive-value" not in messages.messages[1]["content"]
    assert messages.prompt_cache_key.startswith("phase5c:title-suggestions-v1:")
    assert messages.stable_prefix_hash != messages.dynamic_payload_hash


def test_redacted_audit_contains_hashes_usage_and_no_secret_like_payload() -> None:
    request = openai_request(payload=sanitized_payload(source_text="Bearer sample-sensitive-value should be hidden"))
    usage_result = run_openai_dryrun_contract(request, FakeOpenAITransport()).usage

    audit = redact_openai_audit_payload(
        request=request,
        response={"id": "fake-provider-request"},
        provider_request_id="fake-provider-request",
        usage=usage_result,
    )

    assert audit["requestId"] == "phase5c-request-id"
    assert audit["providerRequestId"] == "fake-provider-request"
    assert audit["requestHash"]
    assert audit["responseHash"]
    assert audit["usage"]["promptCachedTokens"] == 40
    assert "sample-sensitive-value" not in str(audit)


def test_normalizer_rejects_free_text_or_extra_fields() -> None:
    with pytest.raises(OpenAIContractError):
        normalize_openai_structured_response({"output_text": "free text response"})

    with pytest.raises(OpenAIContractError):
        normalize_openai_structured_response(
            {
                "suggestions": [
                    {
                        "title": "ok",
                        "rationale": "ok",
                        "tags": [],
                        "riskLevel": "low",
                        "score": 0.8,
                        "extra": "not allowed",
                    }
                ]
            }
        )


def seed_facade_data(session: Session) -> None:
    session.add_all(
        [
            User(id="user-phase5c", username="phase5c", display_name="Phase 5C", status="active"),
            Workspace(id="workspace-phase5c", name="Workspace Phase 5C", slug="workspace-phase5c"),
            WorkspaceMember(id="member-phase5c", workspace_id="workspace-phase5c", user_id="user-phase5c", role="editor"),
        ]
    )
    session.commit()


def test_facade_can_run_openai_contract_only_with_fake_transport(db_session: Session, monkeypatch) -> None:
    seed_facade_data(db_session)
    key_name = "OPENAI" + "_API_KEY"

    def fail_if_real_key_is_read(key: str, default: object = None) -> object:
        if key == key_name:
            raise AssertionError("Phase 5C dry-run must not read real OpenAI key")
        return default

    monkeypatch.setattr(os.environ, "get", fail_if_real_key_is_read)
    policy = build_budget_policy(
        max_input_chars=2000,
        max_output_items=5,
        daily_budget_cents=0,
        timeout_seconds=15,
        max_retries=1,
    )
    readiness = AIProviderReadiness(
        provider="openai",
        model="gpt-placeholder",
        real_provider_enabled=True,
        api_key_required=True,
        api_key_source="managed_server_secret",
        budget_policy=policy,
    )

    data = generate_title_suggestions(
        db=db_session,
        workspace_id="workspace-phase5c",
        user_id="user-phase5c",
        request_payload=AITitleSuggestionRequest(
            sourceText="为标题实验写一组 dry-run 输出",
            contentType="title",
            tone="clear",
            platform="wechat",
            count=2,
        ),
        config=AIFacadeConfig(
            provider="openai",
            real_provider_enabled=True,
            model="gpt-placeholder",
            budget_policy=policy,
            readiness=readiness,
            openai_dryrun_enabled=True,
            openai_transport=FakeOpenAITransport(),
            openai_prompt_cache_key_prefix="phase5c",
        ),
    )

    assert data.provider == "openai"
    assert data.mock is False
    assert len(data.suggestions) == 2
    record = db_session.scalar(select(AiGenerationRecord))
    assert record is not None
    assert record.provider == "openai"
    assert record.input_payload["providerGate"]["apiKeySource"] == "managed_server_secret"


def test_facade_openai_without_dryrun_transport_stays_disabled(db_session: Session) -> None:
    seed_facade_data(db_session)
    policy = build_budget_policy(
        max_input_chars=2000,
        max_output_items=5,
        daily_budget_cents=0,
        timeout_seconds=15,
        max_retries=1,
    )
    readiness = AIProviderReadiness(
        provider="openai",
        model="gpt-placeholder",
        real_provider_enabled=True,
        api_key_required=True,
        api_key_source="managed_server_secret",
        budget_policy=policy,
    )

    with pytest.raises(AIFacadeError) as exc_info:
        generate_title_suggestions(
            db=db_session,
            workspace_id="workspace-phase5c",
            user_id="user-phase5c",
            request_payload=AITitleSuggestionRequest(sourceText="dry-run disabled", count=1),
            config=AIFacadeConfig(
                provider="openai",
                real_provider_enabled=True,
                model="gpt-placeholder",
                budget_policy=policy,
                readiness=readiness,
                openai_dryrun_enabled=False,
                openai_transport=FakeOpenAITransport(),
            ),
        )

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_DISABLED
    assert db_session.scalar(select(AiGenerationRecord)) is None
