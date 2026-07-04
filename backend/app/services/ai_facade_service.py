from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from time import perf_counter
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.core import AiGenerationRecord
from app.schemas import AITitleSuggestionRequest, AITitleSuggestionsData, AIUsageEstimate, ErrorCode
from app.services.ai_budget import AIBudgetError, AIBudgetPolicy, enforce_request_budget
from app.services.ai_openai_contract import OpenAITransport
from app.services.ai_prompt_templates import TITLE_SUGGESTION_PROMPT_VERSION, build_title_suggestion_prompt
from app.services.ai_provider_gate import AIProviderGateError, AIProviderReadiness
from app.services.ai_providers import AIProviderDisabledError, AIProviderRegistry
from app.services.ai_redaction import safe_preview, stable_text_hash
from app.services.ai_safety import AISafetyError, redacted_source_summary, sanitize_title_suggestion_request


class AIFacadeError(RuntimeError):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class AIFacadeConfig:
    provider: str = "mock"
    real_provider_enabled: bool = False
    model: str = ""
    budget_policy: AIBudgetPolicy | None = None
    readiness: AIProviderReadiness | None = None
    openai_dryrun_enabled: bool = False
    openai_transport: OpenAITransport | None = None
    openai_prompt_cache_key_prefix: str = ""


def generate_title_suggestions(
    db: Session,
    workspace_id: str,
    user_id: str,
    request_payload: AITitleSuggestionRequest,
    config: AIFacadeConfig | None = None,
) -> AITitleSuggestionsData:
    active_config = config or AIFacadeConfig()
    budget_policy = active_config.budget_policy
    try:
        sanitized = sanitize_title_suggestion_request(
            source_text=request_payload.sourceText,
            content_type=request_payload.contentType,
            tone=request_payload.tone,
            platform=request_payload.platform,
            count=request_payload.count,
            constraints=request_payload.constraints,
            reference_titles=request_payload.referenceTitles,
            locale=request_payload.locale,
            max_source_text_chars=budget_policy.max_input_chars if budget_policy else 2000,
            max_suggestion_count=budget_policy.max_output_items if budget_policy else 5,
        )
    except AISafetyError as exc:
        raise AIFacadeError(exc.code, str(exc)) from exc
    if budget_policy is not None:
        try:
            enforce_request_budget(budget_policy, len(sanitized.source_text), sanitized.count)
        except AIBudgetError as exc:
            raise AIFacadeError(exc.code, str(exc)) from exc

    prompt = build_title_suggestion_prompt(sanitized)
    try:
        provider = AIProviderRegistry(
            provider_name=active_config.provider,
            real_provider_enabled=active_config.real_provider_enabled,
            model=active_config.model,
            readiness=active_config.readiness,
            openai_dryrun_enabled=active_config.openai_dryrun_enabled,
            openai_transport=active_config.openai_transport,
            openai_prompt_cache_key_prefix=active_config.openai_prompt_cache_key_prefix,
        ).resolve()
    except AIProviderDisabledError as exc:
        raise AIFacadeError(ErrorCode.AI_PROVIDER_DISABLED, str(exc)) from exc
    except AIProviderGateError as exc:
        raise AIFacadeError(exc.code, str(exc)) from exc

    started = perf_counter()
    try:
        suggestions = provider.generate_title_suggestions(sanitized, prompt)
    except AIProviderGateError as exc:
        raise AIFacadeError(exc.code, str(exc)) from exc
    except Exception as exc:
        raise AIFacadeError(ErrorCode.AI_PROVIDER_ERROR, "ai_provider_error") from exc
    latency_ms = int((perf_counter() - started) * 1000)

    usage = AIUsageEstimate(
        inputCharacters=len(sanitized.source_text),
        requestedCount=request_payload.count,
        returnedCount=len(suggestions),
        estimatedTokens=estimate_tokens(sanitized.source_text, prompt, suggestions),
        estimatedInputTokens=max(1, len(prompt) // 4),
        estimatedOutputTokens=max(1, len(str(suggestions)) // 4),
        promptCachedTokens=0,
        estimatedCostCents=0,
    )
    data = AITitleSuggestionsData(
        suggestions=suggestions,
        provider=provider.provider,
        model=provider.model,
        mock=provider.mock,
        usageEstimate=usage,
        warnings=sanitized.warnings,
    )
    persist_generation_record(
        db=db,
        workspace_id=workspace_id,
        user_id=user_id,
        prompt=prompt,
        provider=provider.provider,
        model=provider.model,
        request_payload=request_payload,
        data=data,
        sanitized_source=redacted_source_summary(sanitized),
        source_hash=stable_text_hash(request_payload.sourceText),
        readiness=active_config.readiness,
        latency_ms=latency_ms,
    )
    return data


def estimate_tokens(source_text: str, prompt: str, suggestions: list[object]) -> int:
    return max(1, (len(source_text) + len(prompt) + len(str(suggestions))) // 4)


def persist_generation_record(
    db: Session,
    workspace_id: str,
    user_id: str,
    prompt: str,
    provider: str,
    model: str,
    request_payload: AITitleSuggestionRequest,
    data: AITitleSuggestionsData,
    sanitized_source: str,
    source_hash: str,
    readiness: AIProviderReadiness | None,
    latency_ms: int,
) -> None:
    readiness_payload: dict[str, Any] | None = (
        {
            "realProviderEnabled": readiness.real_provider_enabled,
            "apiKeyRequired": readiness.api_key_required,
            "apiKeySource": readiness.api_key_source,
            "timeoutSeconds": readiness.budget_policy.timeout_seconds,
            "maxRetries": readiness.budget_policy.max_retries,
            "dailyBudgetCents": readiness.budget_policy.daily_budget_cents,
        }
        if readiness is not None
        else None
    )
    db.add(
        AiGenerationRecord(
            id=uuid4().hex,
            workspace_id=workspace_id,
            user_id=user_id,
            prompt=prompt,
            model=model,
            provider=provider,
            input_payload={
                "schemaVersion": "phase5a-title-suggestions-v1",
                "promptVersion": TITLE_SUGGESTION_PROMPT_VERSION,
                "sourceTextPreview": sanitized_source,
                "sourceTextHash": source_hash,
                "contentType": safe_preview(request_payload.contentType, max_chars=40),
                "tone": safe_preview(request_payload.tone or "", max_chars=40),
                "platform": safe_preview(request_payload.platform or "", max_chars=40),
                "count": request_payload.count,
                "locale": request_payload.locale,
                "referenceTitleCount": len(request_payload.referenceTitles),
                "constraintCount": len(request_payload.constraints),
                "providerGate": readiness_payload,
            },
            output_text=data.model_dump_json(),
            status="succeeded",
            latency_ms=latency_ms,
            cost_amount=Decimal("0.0000"),
        )
    )
    db.commit()
