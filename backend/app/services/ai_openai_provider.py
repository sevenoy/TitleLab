from __future__ import annotations

from dataclasses import dataclass

from app.schemas import AITitleSuggestionOut, ErrorCode
from app.services.ai_provider_gate import AIProviderGateError, AIProviderReadiness
from app.services.ai_safety import SanitizedAIRequest

OPENAI_STRUCTURED_OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["suggestions"],
    "additionalProperties": False,
    "properties": {
        "suggestions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": {
                "type": "object",
                "required": ["title", "rationale", "tags", "riskLevel", "score"],
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string", "maxLength": 80},
                    "rationale": {"type": "string", "maxLength": 200},
                    "tags": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
                    "riskLevel": {"type": "string", "enum": ["low", "medium", "high"]},
                    "score": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        }
    },
}


@dataclass(frozen=True)
class OpenAIProviderPlaceholder:
    readiness: AIProviderReadiness

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
        raise AIProviderGateError(ErrorCode.AI_PROVIDER_DISABLED, "ai_real_provider_not_enabled_in_phase5b")


def normalize_structured_suggestions(raw: dict[str, object]) -> list[AITitleSuggestionOut]:
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
