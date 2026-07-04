from __future__ import annotations

from dataclasses import dataclass

from app.schemas import ErrorCode

MIN_TIMEOUT_SECONDS = 1
MAX_TIMEOUT_SECONDS = 60
MAX_RETRIES = 3


class AIBudgetError(ValueError):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class AIBudgetPolicy:
    max_input_chars: int
    max_output_items: int
    daily_budget_cents: int
    timeout_seconds: int
    max_retries: int


def build_budget_policy(
    *,
    max_input_chars: int,
    max_output_items: int,
    daily_budget_cents: int,
    timeout_seconds: int,
    max_retries: int,
) -> AIBudgetPolicy:
    if max_input_chars <= 0 or max_output_items <= 0:
        raise AIBudgetError(ErrorCode.AI_CONFIG_ERROR, "ai_budget_limit_invalid")
    if timeout_seconds < MIN_TIMEOUT_SECONDS or timeout_seconds > MAX_TIMEOUT_SECONDS:
        raise AIBudgetError(ErrorCode.AI_CONFIG_ERROR, "ai_timeout_invalid")
    if max_retries < 0 or max_retries > MAX_RETRIES:
        raise AIBudgetError(ErrorCode.AI_CONFIG_ERROR, "ai_retry_invalid")
    if daily_budget_cents < 0:
        raise AIBudgetError(ErrorCode.AI_CONFIG_ERROR, "ai_budget_invalid")
    return AIBudgetPolicy(
        max_input_chars=max_input_chars,
        max_output_items=max_output_items,
        daily_budget_cents=daily_budget_cents,
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
    )


def estimate_request_units(input_characters: int, output_items: int) -> int:
    return max(1, (input_characters + output_items * 80) // 100)


def enforce_request_budget(policy: AIBudgetPolicy, input_characters: int, output_items: int) -> None:
    if input_characters > policy.max_input_chars:
        raise AIBudgetError(ErrorCode.AI_INPUT_TOO_LONG, "ai_input_too_long")
    if output_items > policy.max_output_items:
        raise AIBudgetError(ErrorCode.AI_RATE_LIMITED, "ai_output_items_too_high")
    if policy.daily_budget_cents == 0:
        return
    if estimate_request_units(input_characters, output_items) > policy.daily_budget_cents:
        raise AIBudgetError(ErrorCode.AI_RATE_LIMITED, "ai_budget_exceeded")
