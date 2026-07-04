#!/usr/bin/env python3
"""Phase 5D live smoke readiness runner.

This runner deliberately refuses live execution in Phase 5D. It builds a safe
readiness plan only; it does not read secret values, open network connections,
or call external provider endpoints.
"""

from __future__ import annotations

import argparse
import json
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a safe Phase 5D live smoke readiness plan.")
    parser.add_argument("--manual-approval", action="store_true", help="Record that a separate manual approval was supplied.")
    parser.add_argument("--api-key-present", action="store_true", help="Record managed server-side key presence as a boolean only.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    blockers = ["ai_live_smoke_disabled", "ai_live_smoke_kill_switch_enabled"]
    if not args.manual_approval:
        blockers.append("ai_live_smoke_manual_approval_required")
    if not args.api_key_present:
        blockers.append("managed_server_secret_presence_not_confirmed")
    payload = {
        "phase": "phase5d-live-openai-smoke-readiness-harness",
        "ready": False,
        "executableInPhase5D": False,
        "status": "REFUSED",
        "reason": blockers[0],
        "provider": "mock",
        "model": "",
        "expectedModel": "",
        "maxRequests": 1,
        "maxBudgetCents": 0,
        "blockers": blockers,
        "notes": [
            "Default Phase 5D behavior is safe refusal.",
            "This standalone runner does not read environment secrets.",
            "Future live execution requires separate Phase 5E authorization.",
        ],
        "realRequestExecuted": False,
        "networkCallPlanned": False,
        "secretValueRead": False,
        "runnerMode": "readiness_only",
        "liveExecutionReservedFor": "phase5e",
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 2


if __name__ == "__main__":
    sys.exit(main())
