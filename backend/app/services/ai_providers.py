from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.schemas import AITitleSuggestionOut
from app.services.ai_openai_provider import OpenAIProviderPlaceholder
from app.services.ai_provider_gate import AIProviderReadiness, OPENAI_PROVIDER
from app.services.ai_safety import SanitizedAIRequest

MOCK_AI_PROVIDER = "mock"
MOCK_AI_MODEL = "titlelab-mock-title-v1"


class AIProvider(Protocol):
    provider: str
    model: str
    mock: bool

    def generate_title_suggestions(self, payload: SanitizedAIRequest, prompt: str) -> list[AITitleSuggestionOut]:
        pass


class MockAIProvider:
    provider = MOCK_AI_PROVIDER
    model = MOCK_AI_MODEL
    mock = True

    def generate_title_suggestions(self, payload: SanitizedAIRequest, prompt: str) -> list[AITitleSuggestionOut]:
        seed = title_seed(payload)
        risk_level = "medium" if payload.contains_secret_like_text else "low"
        suggestions: list[AITitleSuggestionOut] = []
        for index in range(payload.count):
            title = build_mock_title(seed, payload, index)
            suggestions.append(
                AITitleSuggestionOut(
                    title=title,
                    rationale=f"mock suggestion {index + 1} balances {payload.tone} tone for {payload.platform}",
                    tags=build_mock_tags(payload, index),
                    riskLevel=risk_level,
                    score=round(max(0.1, 0.92 - index * 0.07), 2),
                )
            )
        return suggestions


@dataclass(frozen=True)
class AIProviderRegistry:
    provider_name: str
    real_provider_enabled: bool = False
    model: str = ""
    readiness: AIProviderReadiness | None = None

    def resolve(self) -> AIProvider:
        if self.provider_name == MOCK_AI_PROVIDER:
            return MockAIProvider()
        if self.provider_name == OPENAI_PROVIDER and self.readiness is not None:
            return OpenAIProviderPlaceholder(self.readiness)
        if not self.real_provider_enabled:
            raise AIProviderDisabledError("ai_provider_disabled")
        raise AIProviderDisabledError("ai_provider_not_configured")


class AIProviderDisabledError(RuntimeError):
    pass


def title_seed(payload: SanitizedAIRequest) -> str:
    if payload.contains_secret_like_text:
        return "安全改写"
    for reference_title in payload.reference_titles:
        if reference_title:
            return reference_title[:18]
    return payload.source_text[:18] or "标题灵感"


def build_mock_title(seed: str, payload: SanitizedAIRequest, index: int) -> str:
    variants = [
        f"{seed}：把亮点讲清楚",
        f"{seed}，给用户一个打开理由",
        f"{seed}｜更适合收藏的表达",
        f"{seed}，从场景切入更有吸引力",
        f"{seed}：少一点套路，多一点具体",
    ]
    title = variants[index % len(variants)]
    if payload.locale == "en-US":
        title = f"{seed}: a clearer reason to click"
    return title[:80]


def build_mock_tags(payload: SanitizedAIRequest, index: int) -> list[str]:
    tags = [payload.content_type, payload.platform, payload.tone]
    if payload.constraints:
        tags.append("constraint-aware")
    if index == 0:
        tags.append("recommended")
    return tags[:4]
