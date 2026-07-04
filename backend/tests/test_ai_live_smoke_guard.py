import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.config import Settings
from app.schemas import ErrorCode
from app.services.ai_live_smoke_guard import (
    LiveSmokeGuardError,
    build_live_smoke_plan,
    normalize_live_smoke_error,
    validate_live_smoke_readiness,
)

ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "scripts" / "titlelab_phase5d_live_openai_smoke_runner.py"


def settings(**overrides: object) -> Settings:
    return Settings(_env_file=None, **overrides)


def enabled_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "titlelab_ai_provider": "openai",
        "titlelab_ai_real_provider_enabled": True,
        "titlelab_ai_model": "gpt-placeholder-live-smoke",
        "titlelab_ai_live_smoke_enabled": True,
        "titlelab_ai_live_smoke_kill_switch": False,
        "titlelab_ai_live_smoke_expected_model": "gpt-placeholder-live-smoke",
        "titlelab_ai_live_smoke_max_requests": 1,
        "titlelab_ai_live_smoke_max_budget_cents": 5,
    }
    values.update(overrides)
    return settings(**values)


def test_default_live_smoke_is_disabled() -> None:
    with pytest.raises(LiveSmokeGuardError) as exc_info:
        validate_live_smoke_readiness(settings())

    assert exc_info.value.code == ErrorCode.AI_PROVIDER_DISABLED
    assert str(exc_info.value) == "ai_live_smoke_disabled"


def test_kill_switch_blocks_even_when_enabled() -> None:
    with pytest.raises(LiveSmokeGuardError) as exc_info:
        validate_live_smoke_readiness(
            settings(
                titlelab_ai_live_smoke_enabled=True,
                titlelab_ai_live_smoke_kill_switch=True,
            )
        )

    assert str(exc_info.value) == "ai_live_smoke_kill_switch_enabled"


def test_missing_manual_approval_blocks_readiness() -> None:
    with pytest.raises(LiveSmokeGuardError) as exc_info:
        validate_live_smoke_readiness(enabled_settings(), manual_approval=False, api_key_present=True)

    assert str(exc_info.value) == "ai_live_smoke_manual_approval_required"


def test_missing_budget_blocks_readiness() -> None:
    with pytest.raises(LiveSmokeGuardError) as exc_info:
        validate_live_smoke_readiness(
            enabled_settings(titlelab_ai_live_smoke_max_budget_cents=0),
            manual_approval=True,
            api_key_present=True,
        )

    assert str(exc_info.value) == "ai_live_smoke_budget_required"


def test_missing_expected_model_blocks_readiness() -> None:
    with pytest.raises(LiveSmokeGuardError) as exc_info:
        validate_live_smoke_readiness(
            enabled_settings(titlelab_ai_live_smoke_expected_model=""),
            manual_approval=True,
            api_key_present=True,
        )

    assert str(exc_info.value) == "ai_live_smoke_expected_model_required"


def test_max_requests_above_one_blocks_readiness() -> None:
    with pytest.raises(LiveSmokeGuardError) as exc_info:
        validate_live_smoke_readiness(
            enabled_settings(titlelab_ai_live_smoke_max_requests=2),
            manual_approval=True,
            api_key_present=True,
        )

    assert str(exc_info.value) == "ai_live_smoke_max_requests_must_be_1"


def test_readiness_passes_only_with_synthetic_gates_and_no_secret_value() -> None:
    readiness = validate_live_smoke_readiness(
        enabled_settings(),
        manual_approval=True,
        api_key_present=True,
    )

    assert readiness.provider == "openai"
    assert readiness.model == "gpt-placeholder-live-smoke"
    assert readiness.max_requests == 1
    assert readiness.max_budget_cents == 5
    assert readiness.api_key_source == "managed_server_secret"
    assert readiness.network_call_planned is False


def test_plan_never_marks_phase5d_executable() -> None:
    plan = build_live_smoke_plan(
        enabled_settings(),
        manual_approval=True,
        api_key_present=True,
    )

    assert plan.ready is True
    assert plan.executable_in_phase5d is False
    assert plan.to_safe_dict()["realRequestExecuted"] is False


def test_normalize_live_smoke_error_uses_stable_error_code() -> None:
    error = LiveSmokeGuardError(ErrorCode.AI_CONFIG_ERROR, "ai_live_smoke_budget_required")

    assert normalize_live_smoke_error(error) == {
        "code": "AI_CONFIG_ERROR",
        "message": "ai_live_smoke_budget_required",
    }


def test_runner_default_refuses_without_reading_key_or_network() -> None:
    result = subprocess.run(
        [sys.executable, str(RUNNER)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode != 0
    payload = json.loads(result.stdout)
    assert payload["status"] == "REFUSED"
    assert payload["realRequestExecuted"] is False
    assert payload["networkCallPlanned"] is False
    assert payload["secretValueRead"] is False
    assert "OPENAI" not in result.stdout
