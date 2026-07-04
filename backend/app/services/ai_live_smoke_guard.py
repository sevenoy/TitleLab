from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import Settings
from app.schemas import ErrorCode
from app.services.ai_provider_gate import (
    OPENAI_PROVIDER,
    AIProviderGateError,
    AIProviderReadiness,
    validate_ai_provider_readiness,
)

LIVE_SMOKE_PHASE = "phase5d-live-openai-smoke-readiness-harness"
MAX_LIVE_SMOKE_REQUESTS = 1
MAX_LIVE_SMOKE_BUDGET_CENTS = 5
MANAGED_SERVER_SECRET_SOURCE = "managed_server_secret"


class LiveSmokeGuardError(RuntimeError):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class LiveSmokeReadiness:
    provider: str
    model: str
    expected_model: str
    max_requests: int
    max_budget_cents: int
    timeout_seconds: int
    max_retries: int
    manual_approval_present: bool
    api_key_source: str
    network_call_planned: bool = False


@dataclass(frozen=True)
class LiveSmokePlan:
    phase: str
    ready: bool
    executable_in_phase5d: bool
    status: str
    reason: str
    provider: str
    model: str
    expected_model: str
    max_requests: int
    max_budget_cents: int
    blockers: list[str]
    notes: list[str]

    def to_safe_dict(self) -> dict[str, Any]:
        return {
            "phase": self.phase,
            "ready": self.ready,
            "executableInPhase5D": self.executable_in_phase5d,
            "status": self.status,
            "reason": self.reason,
            "provider": self.provider,
            "model": self.model,
            "expectedModel": self.expected_model,
            "maxRequests": self.max_requests,
            "maxBudgetCents": self.max_budget_cents,
            "blockers": self.blockers,
            "notes": self.notes,
            "realRequestExecuted": False,
            "networkCallPlanned": False,
            "secretValueRead": False,
        }


def validate_live_smoke_readiness(
    settings: Settings,
    *,
    manual_approval: bool = False,
    api_key_present: bool = False,
) -> LiveSmokeReadiness:
    provider = settings.titlelab_ai_provider.strip().lower() or "mock"
    model = settings.titlelab_ai_model.strip()
    expected_model = settings.titlelab_ai_live_smoke_expected_model.strip()
    max_requests = settings.titlelab_ai_live_smoke_max_requests
    max_budget_cents = settings.titlelab_ai_live_smoke_max_budget_cents

    if not settings.titlelab_ai_live_smoke_enabled:
        raise LiveSmokeGuardError(ErrorCode.AI_PROVIDER_DISABLED, "ai_live_smoke_disabled")
    if settings.titlelab_ai_live_smoke_kill_switch:
        raise LiveSmokeGuardError(ErrorCode.AI_PROVIDER_DISABLED, "ai_live_smoke_kill_switch_enabled")
    if settings.titlelab_ai_live_smoke_require_manual_approval and not manual_approval:
        raise LiveSmokeGuardError(ErrorCode.AI_PROVIDER_DISABLED, "ai_live_smoke_manual_approval_required")
    if max_requests != MAX_LIVE_SMOKE_REQUESTS:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_max_requests_must_be_1")
    if max_budget_cents <= 0:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_budget_required")
    if max_budget_cents > MAX_LIVE_SMOKE_BUDGET_CENTS:
        raise LiveSmokeGuardError(ErrorCode.AI_RATE_LIMITED, "ai_live_smoke_budget_too_high")
    if provider != OPENAI_PROVIDER:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_requires_openai_provider")
    if not expected_model:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_expected_model_required")
    if not model:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_model_required")
    if model != expected_model:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_expected_model_mismatch")

    readiness = _validate_provider_gate(settings, api_key_present=api_key_present)
    if readiness.api_key_source != MANAGED_SERVER_SECRET_SOURCE:
        raise LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_requires_managed_server_secret")
    return LiveSmokeReadiness(
        provider=readiness.provider,
        model=readiness.model,
        expected_model=expected_model,
        max_requests=max_requests,
        max_budget_cents=max_budget_cents,
        timeout_seconds=readiness.budget_policy.timeout_seconds,
        max_retries=readiness.budget_policy.max_retries,
        manual_approval_present=manual_approval,
        api_key_source=readiness.api_key_source,
    )


def assert_live_smoke_readiness(
    settings: Settings,
    *,
    manual_approval: bool = False,
    api_key_present: bool = False,
) -> LiveSmokeReadiness:
    return validate_live_smoke_readiness(
        settings,
        manual_approval=manual_approval,
        api_key_present=api_key_present,
    )


def build_live_smoke_plan(
    settings: Settings,
    *,
    manual_approval: bool = False,
    api_key_present: bool = False,
) -> LiveSmokePlan:
    try:
        readiness = validate_live_smoke_readiness(
            settings,
            manual_approval=manual_approval,
            api_key_present=api_key_present,
        )
    except LiveSmokeGuardError as exc:
        return _blocked_plan(settings, str(exc))

    return LiveSmokePlan(
        phase=LIVE_SMOKE_PHASE,
        ready=True,
        executable_in_phase5d=False,
        status="READY_FOR_FUTURE_PHASE_ONLY",
        reason="phase5d_readiness_passed_execution_reserved_for_phase5e",
        provider=readiness.provider,
        model=readiness.model,
        expected_model=readiness.expected_model,
        max_requests=readiness.max_requests,
        max_budget_cents=readiness.max_budget_cents,
        blockers=[],
        notes=[
            "Phase 5D does not execute live traffic.",
            "A future Phase 5E needs separate explicit authorization.",
            "No secret value is read or printed by this guard.",
        ],
    )


def normalize_live_smoke_error(error: Exception | str) -> dict[str, str]:
    if isinstance(error, LiveSmokeGuardError):
        return {"code": error.code.value, "message": str(error)}
    if isinstance(error, AIProviderGateError):
        return {"code": error.code.value, "message": str(error)}
    return {"code": ErrorCode.AI_PROVIDER_ERROR.value, "message": str(error)}


def _validate_provider_gate(settings: Settings, *, api_key_present: bool) -> AIProviderReadiness:
    try:
        return validate_ai_provider_readiness(settings, api_key_present=api_key_present)
    except AIProviderGateError as exc:
        raise LiveSmokeGuardError(exc.code, str(exc)) from exc


def _blocked_plan(settings: Settings, reason: str) -> LiveSmokePlan:
    return LiveSmokePlan(
        phase=LIVE_SMOKE_PHASE,
        ready=False,
        executable_in_phase5d=False,
        status="REFUSED",
        reason=reason,
        provider=settings.titlelab_ai_provider.strip().lower() or "mock",
        model=settings.titlelab_ai_model.strip(),
        expected_model=settings.titlelab_ai_live_smoke_expected_model.strip(),
        max_requests=settings.titlelab_ai_live_smoke_max_requests,
        max_budget_cents=settings.titlelab_ai_live_smoke_max_budget_cents,
        blockers=[reason],
        notes=[
            "Default Phase 5D behavior is safe refusal.",
            "No real provider request was executed.",
            "No secret value was read or printed.",
        ],
    )
