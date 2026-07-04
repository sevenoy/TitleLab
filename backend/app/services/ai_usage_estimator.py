from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class OpenAIUsageEstimate:
    input_tokens: int
    output_tokens: int
    total_tokens: int
    prompt_cached_tokens: int
    estimated_cost_cents: int = 0


def estimate_openai_usage(
    *,
    messages: list[dict[str, str]],
    suggestion_count: int,
    raw_usage: dict[str, Any] | None = None,
) -> OpenAIUsageEstimate:
    if raw_usage is not None:
        input_tokens = int(raw_usage.get("input_tokens", raw_usage.get("prompt_tokens", 0)) or 0)
        output_tokens = int(raw_usage.get("output_tokens", raw_usage.get("completion_tokens", 0)) or 0)
        details = raw_usage.get("input_token_details") or raw_usage.get("prompt_tokens_details") or {}
        cached_tokens = 0
        if isinstance(details, dict):
            cached_tokens = int(details.get("cached_tokens", 0) or 0)
        total_tokens = int(raw_usage.get("total_tokens", input_tokens + output_tokens) or input_tokens + output_tokens)
        return OpenAIUsageEstimate(
            input_tokens=max(0, input_tokens),
            output_tokens=max(0, output_tokens),
            total_tokens=max(0, total_tokens),
            prompt_cached_tokens=max(0, cached_tokens),
            estimated_cost_cents=0,
        )

    prompt_chars = sum(len(message.get("content", "")) for message in messages)
    input_tokens = max(1, prompt_chars // 4)
    output_tokens = max(1, suggestion_count * 80 // 4)
    return OpenAIUsageEstimate(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
        prompt_cached_tokens=0,
        estimated_cost_cents=0,
    )
