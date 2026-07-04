import pytest

from app.config import Settings
from app.schemas import ErrorCode
from app.services.ai_budget import build_budget_policy, enforce_request_budget
from app.services.ai_provider_gate import AIProviderGateError, validate_ai_provider_readiness
from app.services.ai_redaction import REDACTED_SECRET_MARKER, safe_preview, stable_text_hash


def test_mock_provider_passes_with_real_gate_disabled() -> None:
    readiness = validate_ai_provider_readiness(Settings(), api_key_present=False)

    assert readiness.provider == "mock"
    assert readiness.model == "titlelab-mock-title-v1"
    assert readiness.real_provider_enabled is False
    assert readiness.api_key_required is False
    assert readiness.api_key_source == "not_required"
    assert readiness.budget_policy.timeout_seconds == 15
    assert readiness.budget_policy.max_retries == 1


def test_openai_provider_with_real_gate_disabled_fails_fast() -> None:
    with pytest.raises(AIProviderGateError) as exc_info:
        validate_ai_provider_readiness(Settings(titlelab_ai_provider="openai"), api_key_present=False)

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_DISABLED
    assert str(exc_info.value) == "ai_real_provider_disabled"


def test_real_provider_enabled_requires_model_and_managed_key() -> None:
    with pytest.raises(AIProviderGateError) as missing_model:
        validate_ai_provider_readiness(
            Settings(titlelab_ai_provider="openai", titlelab_ai_real_provider_enabled=True),
            api_key_present=False,
        )
    assert missing_model.value.code == ErrorCode.AI_CONFIG_ERROR

    with pytest.raises(AIProviderGateError) as missing_key:
        validate_ai_provider_readiness(
            Settings(
                titlelab_ai_provider="openai",
                titlelab_ai_real_provider_enabled=True,
                titlelab_ai_model="gpt-placeholder",
            ),
            api_key_present=False,
        )
    assert missing_key.value.code == ErrorCode.AI_PROVIDER_DISABLED


def test_real_provider_readiness_records_secret_source_without_secret_value() -> None:
    readiness = validate_ai_provider_readiness(
        Settings(
            titlelab_ai_provider="openai",
            titlelab_ai_real_provider_enabled=True,
            titlelab_ai_model="gpt-placeholder",
            titlelab_ai_timeout_seconds=20,
            titlelab_ai_max_retries=2,
            titlelab_ai_daily_budget_cents=100,
        ),
        api_key_present=True,
    )

    assert readiness.provider == "openai"
    assert readiness.model == "gpt-placeholder"
    assert readiness.api_key_required is True
    assert readiness.api_key_source == "managed_server_secret"
    assert readiness.budget_policy.timeout_seconds == 20
    assert readiness.budget_policy.max_retries == 2
    assert readiness.budget_policy.daily_budget_cents == 100


def test_budget_policy_validates_timeout_retry_and_limits() -> None:
    policy = build_budget_policy(
        max_input_chars=10,
        max_output_items=2,
        daily_budget_cents=0,
        timeout_seconds=5,
        max_retries=1,
    )

    enforce_request_budget(policy, input_characters=10, output_items=2)
    with pytest.raises(Exception) as too_much_input:
        enforce_request_budget(policy, input_characters=11, output_items=2)
    assert getattr(too_much_input.value, "code") == ErrorCode.AI_INPUT_TOO_LONG
    with pytest.raises(Exception) as too_many_items:
        enforce_request_budget(policy, input_characters=10, output_items=3)
    assert getattr(too_many_items.value, "code") == ErrorCode.AI_RATE_LIMITED


def test_redaction_preview_and_hash_do_not_reveal_secret_like_values() -> None:
    value = "Bearer sample-sensitive-value should not be echoed"

    assert safe_preview(value) == REDACTED_SECRET_MARKER
    assert "sample-sensitive-value" not in stable_text_hash(value)
