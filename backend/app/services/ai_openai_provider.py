from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.schemas import AITitleSuggestionOut, ErrorCode
from app.services.ai_openai_contract import (
    OpenAIContractError,
    OpenAITransport,
    build_openai_title_suggestion_request,
    build_structured_output_schema,
    run_openai_dryrun_contract,
)
from app.services.ai_provider_gate import AIProviderGateError, AIProviderReadiness
from app.services.ai_safety import SanitizedAIRequest

OPENAI_STRUCTURED_OUTPUT_SCHEMA = build_structured_output_schema()["json_schema"]["schema"]


@dataclass(frozen=True)
class OpenAIProviderPlaceholder:
    readiness: AIProviderReadiness
    dry_run_enabled: bool = False
    transport: OpenAITransport | None = None
    prompt_cache_key_prefix: str = ""

    @property
    def provider(self) -> str:
        return "openai"

    @property
    def model(self) -> str:
        return self.readiness.model

    @property
    def mock(self) -> bool:
        return False

    def generate_title_suggestions(self, payload: SanitizedAIRequest, prompt: str) -> list[AITitleSuggestionOut]:
        if not self.dry_run_enabled or self.transport is None:
            raise AIProviderGateError(ErrorCode.AI_PROVIDER_DISABLED, "ai_openai_provider_dryrun_disabled")
        request = build_openai_title_suggestion_request(
            payload,
            model=self.readiness.model,
            timeout_seconds=self.readiness.budget_policy.timeout_seconds,
            max_retries=self.readiness.budget_policy.max_retries,
            prompt_cache_key_prefix=self.prompt_cache_key_prefix,
        )
        try:
            result = run_openai_dryrun_contract(request, self.transport)
        except OpenAIContractError as exc:
            raise AIProviderGateError(exc.code, str(exc)) from exc
        return result.suggestions


def normalize_structured_suggestions(raw: dict[str, Any]) -> list[AITitleSuggestionOut]:
    values = raw.get("suggestions")
    if not isinstance(values, list):
        raise AIProviderGateError(ErrorCode.AI_PROVIDER_ERROR, "ai_provider_output_invalid")

    suggestions: list[AITitleSuggestionOut] = []
    for value in values:
        if not isinstance(value, dict):
            raise AIProviderGateError(ErrorCode.AI_PROVIDER_ERROR, "ai_provider_output_invalid")
        suggestions.append(
            AITitleSuggestionOut(
                title=str(value.get("title", ""))[:80],
                rationale=str(value.get("rationale", ""))[:200],
                tags=[str(tag)[:40] for tag in value.get("tags", [])[:6]],
                riskLevel=normalize_risk_level(str(value.get("riskLevel", "medium"))),
                score=max(0.0, min(1.0, float(value.get("score", 0.5)))),
            )
        )
    if not suggestions:
        raise AIProviderGateError(ErrorCode.AI_PROVIDER_ERROR, "ai_provider_output_empty")
    return suggestions


def normalize_risk_level(value: str) -> str:
    return value if value in {"low", "medium", "high"} else "medium"
