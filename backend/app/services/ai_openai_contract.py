from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import uuid4

from app.schemas import AITitleSuggestionOut, ErrorCode
from app.services.ai_prompt_templates import TITLE_SUGGESTION_PROMPT_VERSION
from app.services.ai_redaction import safe_preview, stable_text_hash
from app.services.ai_safety import SanitizedAIRequest, redacted_source_summary
from app.services.ai_usage_estimator import OpenAIUsageEstimate, estimate_openai_usage

STRUCTURED_OUTPUT_SCHEMA_NAME = "titlelab_title_suggestions_v1"
DEFAULT_PROMPT_CACHE_KEY_PREFIX = "titlelab-ai-title-suggestions"


class OpenAIContractError(RuntimeError):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        super().__init__(message)


class OpenAITransportError(RuntimeError):
    def __init__(self, kind: str, message: str = "openai_transport_error") -> None:
        self.kind = kind
        super().__init__(message)


@dataclass(frozen=True)
class PromptCacheFriendlyMessages:
    messages: list[dict[str, str]]
    prompt_cache_key: str
    stable_prefix_hash: str
    dynamic_payload_hash: str


@dataclass(frozen=True)
class OpenAITitleSuggestionRequest:
    request_id: str
    model: str
    messages: list[dict[str, str]]
    response_format: dict[str, Any]
    timeout_seconds: int
    max_retries: int
    requested_count: int
    prompt_cache_key: str
    stable_prefix_hash: str
    dynamic_payload_hash: str

    def to_transport_payload(self) -> dict[str, Any]:
        return {
            "requestId": self.request_id,
            "model": self.model,
            "messages": self.messages,
            "responseFormat": self.response_format,
            "timeoutSeconds": self.timeout_seconds,
            "maxRetries": self.max_retries,
            "requestedCount": self.requested_count,
            "promptCacheKey": self.prompt_cache_key,
        }


@dataclass(frozen=True)
class OpenAIContractResult:
    suggestions: list[AITitleSuggestionOut]
    usage: OpenAIUsageEstimate
    audit_payload: dict[str, Any]
    provider_request_id: str


class OpenAITransport(Protocol):
    def create_title_suggestions(self, request: OpenAITitleSuggestionRequest) -> dict[str, Any]:
        pass


def build_structured_output_schema(max_suggestions: int = 5) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": STRUCTURED_OUTPUT_SCHEMA_NAME,
            "strict": True,
            "schema": {
                "type": "object",
                "required": ["suggestions"],
                "additionalProperties": False,
                "properties": {
                    "suggestions": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": max_suggestions,
                        "items": {
                            "type": "object",
                            "required": ["title", "rationale", "tags", "riskLevel", "score"],
                            "additionalProperties": False,
                            "properties": {
                                "title": {"type": "string", "minLength": 1, "maxLength": 80},
                                "rationale": {"type": "string", "minLength": 1, "maxLength": 200},
                                "tags": {
                                    "type": "array",
                                    "items": {"type": "string", "minLength": 1, "maxLength": 40},
                                    "maxItems": 6,
                                },
                                "riskLevel": {"type": "string", "enum": ["low", "medium", "high"]},
                                "score": {"type": "number", "minimum": 0, "maximum": 1},
                            },
                        },
                    }
                },
            },
        },
    }


def build_prompt_cache_friendly_messages(
    payload: SanitizedAIRequest,
    *,
    prompt_cache_key_prefix: str = "",
) -> PromptCacheFriendlyMessages:
    stable_prefix = "\n".join(
        [
            "You are TitleLab backend AI provider.",
            "Return only structured title suggestions that match the supplied JSON schema.",
            "Never expose secrets, credentials, tokens, cookies, or raw unsafe input.",
            "Each suggestion must include title, rationale, tags, riskLevel, and score.",
            f"promptVersion={TITLE_SUGGESTION_PROMPT_VERSION}",
            f"schemaName={STRUCTURED_OUTPUT_SCHEMA_NAME}",
        ]
    )
    dynamic_payload = "\n".join(
        [
            f"locale={payload.locale}",
            f"contentType={payload.content_type}",
            f"tone={payload.tone}",
            f"platform={payload.platform}",
            f"count={payload.count}",
            "constraints=" + json.dumps(payload.constraints, ensure_ascii=False, separators=(",", ":")),
            "referenceTitles=" + json.dumps(payload.reference_titles, ensure_ascii=False, separators=(",", ":")),
            f"sourceText={redacted_source_summary(payload)}",
        ]
    )
    cache_prefix = prompt_cache_key_prefix.strip() or DEFAULT_PROMPT_CACHE_KEY_PREFIX
    return PromptCacheFriendlyMessages(
        messages=[
            {"role": "system", "content": stable_prefix},
            {"role": "user", "content": dynamic_payload},
        ],
        prompt_cache_key=f"{cache_prefix}:{TITLE_SUGGESTION_PROMPT_VERSION}:{STRUCTURED_OUTPUT_SCHEMA_NAME}",
        stable_prefix_hash=stable_text_hash(stable_prefix),
        dynamic_payload_hash=stable_text_hash(dynamic_payload),
    )


def build_openai_title_suggestion_request(
    payload: SanitizedAIRequest,
    *,
    model: str,
    timeout_seconds: int,
    max_retries: int,
    prompt_cache_key_prefix: str = "",
    request_id: str | None = None,
) -> OpenAITitleSuggestionRequest:
    messages = build_prompt_cache_friendly_messages(payload, prompt_cache_key_prefix=prompt_cache_key_prefix)
    return OpenAITitleSuggestionRequest(
        request_id=request_id or uuid4().hex,
        model=model,
        messages=messages.messages,
        response_format=build_structured_output_schema(max_suggestions=payload.count),
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
        requested_count=payload.count,
        prompt_cache_key=messages.prompt_cache_key,
        stable_prefix_hash=messages.stable_prefix_hash,
        dynamic_payload_hash=messages.dynamic_payload_hash,
    )


def normalize_openai_structured_response(raw: dict[str, Any]) -> list[AITitleSuggestionOut]:
    parsed = parse_structured_response_body(raw)
    values = parsed.get("suggestions")
    if not isinstance(values, list) or not values:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")

    suggestions: list[AITitleSuggestionOut] = []
    for value in values:
        suggestions.append(validate_suggestion(value))
    return suggestions


def parse_structured_response_body(raw: dict[str, Any]) -> dict[str, Any]:
    if "suggestions" in raw:
        return raw
    if not raw:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    if isinstance(raw.get("output_text"), str):
        return decode_structured_json(raw["output_text"])
    output = raw.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if not isinstance(content, list):
                continue
            for content_item in content:
                if isinstance(content_item, dict) and isinstance(content_item.get("text"), str):
                    return decode_structured_json(content_item["text"])
    raise OpenAIContractError(ErrorCode.AI_PROVIDER_BAD_RESPONSE, "ai_provider_bad_response")


def decode_structured_json(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_BAD_RESPONSE, "ai_provider_malformed_json") from exc
    if not isinstance(parsed, dict):
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    return parsed


def validate_suggestion(value: Any) -> AITitleSuggestionOut:
    if not isinstance(value, dict):
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    required = {"title", "rationale", "tags", "riskLevel", "score"}
    if set(value) != required:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    if not isinstance(value["title"], str) or not value["title"].strip() or len(value["title"]) > 80:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    if not isinstance(value["rationale"], str) or not value["rationale"].strip() or len(value["rationale"]) > 200:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    if not isinstance(value["tags"], list) or len(value["tags"]) > 6 or not all(isinstance(tag, str) for tag in value["tags"]):
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    if value["riskLevel"] not in {"low", "medium", "high"}:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    score = value["score"]
    if not isinstance(score, int | float) or score < 0 or score > 1:
        raise OpenAIContractError(ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH, "ai_provider_schema_mismatch")
    return AITitleSuggestionOut(
        title=value["title"],
        rationale=value["rationale"],
        tags=[tag[:40] for tag in value["tags"]],
        riskLevel=value["riskLevel"],
        score=float(score),
    )


def map_openai_error(error: Exception | str) -> ErrorCode:
    kind = error.kind if isinstance(error, OpenAITransportError) else str(error)
    normalized = kind.lower()
    if "rate" in normalized or "429" in normalized:
        return ErrorCode.AI_PROVIDER_RATE_LIMITED
    if "timeout" in normalized or "timed out" in normalized:
        return ErrorCode.AI_PROVIDER_TIMEOUT
    if "schema" in normalized:
        return ErrorCode.AI_PROVIDER_SCHEMA_MISMATCH
    if "bad_response" in normalized or "malformed" in normalized:
        return ErrorCode.AI_PROVIDER_BAD_RESPONSE
    return ErrorCode.AI_PROVIDER_ERROR


def run_openai_dryrun_contract(
    request: OpenAITitleSuggestionRequest,
    transport: OpenAITransport,
) -> OpenAIContractResult:
    try:
        raw = transport.create_title_suggestions(request)
        suggestions = normalize_openai_structured_response(raw)
    except OpenAITransportError as exc:
        raise OpenAIContractError(map_openai_error(exc), str(exc)) from exc
    provider_request_id = str(raw.get("id") or raw.get("request_id") or request.request_id)
    usage = estimate_openai_usage(
        messages=request.messages,
        suggestion_count=len(suggestions),
        raw_usage=raw.get("usage") if isinstance(raw.get("usage"), dict) else None,
    )
    audit_payload = redact_openai_audit_payload(
        request=request,
        response=raw,
        provider_request_id=provider_request_id,
        usage=usage,
    )
    return OpenAIContractResult(
        suggestions=suggestions,
        usage=usage,
        audit_payload=audit_payload,
        provider_request_id=provider_request_id,
    )


def redact_openai_audit_payload(
    *,
    request: OpenAITitleSuggestionRequest,
    response: dict[str, Any] | None = None,
    provider_request_id: str | None = None,
    usage: OpenAIUsageEstimate | None = None,
    error_code: ErrorCode | None = None,
) -> dict[str, Any]:
    request_payload = request.to_transport_payload()
    response_payload = response or {}
    prompt_preview = "\n".join(safe_preview(message["content"], max_chars=120) for message in request.messages)
    return {
        "schemaVersion": "phase5c-openai-dryrun-contract-v1",
        "requestId": request.request_id,
        "providerRequestId": provider_request_id,
        "model": request.model,
        "promptCacheKey": request.prompt_cache_key,
        "stablePrefixHash": request.stable_prefix_hash,
        "dynamicPayloadHash": request.dynamic_payload_hash,
        "requestHash": stable_text_hash(json.dumps(request_payload, ensure_ascii=False, sort_keys=True)),
        "responseHash": stable_text_hash(json.dumps(response_payload, ensure_ascii=False, sort_keys=True)),
        "promptPreview": safe_preview(prompt_preview, max_chars=240),
        "messageCount": len(request.messages),
        "usage": {
            "inputTokens": usage.input_tokens if usage else 0,
            "outputTokens": usage.output_tokens if usage else 0,
            "totalTokens": usage.total_tokens if usage else 0,
            "promptCachedTokens": usage.prompt_cached_tokens if usage else 0,
            "estimatedCostCents": usage.estimated_cost_cents if usage else 0,
        },
        "errorCode": error_code.value if error_code else None,
    }


class FakeOpenAITransport:
    def __init__(self, scenario: str = "success", usage: dict[str, Any] | None = None) -> None:
        self.scenario = scenario
        self.usage = usage or {
            "input_tokens": 120,
            "output_tokens": 60,
            "total_tokens": 180,
            "input_token_details": {"cached_tokens": 40},
        }
        self.calls: list[OpenAITitleSuggestionRequest] = []

    def create_title_suggestions(self, request: OpenAITitleSuggestionRequest) -> dict[str, Any]:
        self.calls.append(request)
        if self.scenario == "rate_limit":
            raise OpenAITransportError("rate_limit", "ai_provider_rate_limited")
        if self.scenario == "timeout":
            raise OpenAITransportError("timeout", "ai_provider_timeout")
        if self.scenario == "provider_error":
            raise OpenAITransportError("provider_error", "ai_provider_error")
        if self.scenario == "malformed_json":
            output_text = "{not valid json"
        elif self.scenario == "schema_mismatch":
            output_text = json.dumps({"suggestions": [{"title": "missing required fields"}]}, ensure_ascii=False)
        else:
            output_text = json.dumps({"suggestions": fake_suggestions(request.requested_count)}, ensure_ascii=False)
        return {
            "id": f"fake-openai-{request.request_id}",
            "output_text": output_text,
            "usage": self.usage,
        }


def fake_suggestions(count: int) -> list[dict[str, Any]]:
    values = []
    for index in range(count):
        values.append(
            {
                "title": f"测试标题建议 {index + 1}",
                "rationale": "fake transport structured response",
                "tags": ["dryrun", "structured"],
                "riskLevel": "low",
                "score": round(0.91 - index * 0.03, 2),
            }
        )
    return values
