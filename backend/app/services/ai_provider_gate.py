from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings
from app.schemas import ErrorCode
from app.services.ai_budget import AIBudgetError, AIBudgetPolicy, build_budget_policy

MOCK_PROVIDER = "mock"
OPENAI_PROVIDER = "openai"
SUPPORTED_PROVIDERS = {MOCK_PROVIDER, OPENAI_PROVIDER}


class AIProviderGateError(RuntimeError):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class AIProviderReadiness:
    provider: str
    model: str
    real_provider_enabled: bool
    api_key_required: bool
    api_key_source: str
    budget_policy: AIBudgetPolicy


def validate_ai_provider_readiness(settings: Settings, *, api_key_present: bool = False) -> AIProviderReadiness:
    provider = settings.titlelab_ai_provider.strip().lower() or MOCK_PROVIDER
    if provider not in SUPPORTED_PROVIDERS:
        raise AIProviderGateError(ErrorCode.AI_CONFIG_ERROR, "ai_provider_unsupported")

    try:
        budget_policy = build_budget_policy(
            max_input_chars=settings.titlelab_ai_max_input_chars,
            max_output_items=settings.titlelab_ai_max_output_items,
            daily_budget_cents=settings.titlelab_ai_daily_budget_cents,
            timeout_seconds=settings.titlelab_ai_timeout_seconds,
            max_retries=settings.titlelab_ai_max_retries,
        )
    except AIBudgetError as exc:
        raise AIProviderGateError(exc.code, str(exc)) from exc

    if not settings.titlelab_ai_real_provider_enabled:
        if provider != MOCK_PROVIDER:
            raise AIProviderGateError(ErrorCode.AI_PROVIDER_DISABLED, "ai_real_provider_disabled")
        return AIProviderReadiness(
            provider=MOCK_PROVIDER,
            model=settings.titlelab_ai_model.strip() or "titlelab-mock-title-v1",
            real_provider_enabled=False,
            api_key_required=False,
            api_key_source="not_required",
            budget_policy=budget_policy,
        )

    if provider == MOCK_PROVIDER:
        raise AIProviderGateError(ErrorCode.AI_CONFIG_ERROR, "ai_real_provider_requires_non_mock_provider")

    model = settings.titlelab_ai_model.strip()
    if not model:
        raise AIProviderGateError(ErrorCode.AI_CONFIG_ERROR, "ai_model_required")
    if not api_key_present:
        raise AIProviderGateError(ErrorCode.AI_PROVIDER_DISABLED, "ai_api_key_not_configured")

    return AIProviderReadiness(
        provider=provider,
        model=model,
        real_provider_enabled=True,
        api_key_required=True,
        api_key_source="managed_server_secret",
        budget_policy=budget_policy,
    )


def assert_ai_provider_readiness(settings: Settings, *, api_key_present: bool = False) -> AIProviderReadiness:
    return validate_ai_provider_readiness(settings, api_key_present=api_key_present)
