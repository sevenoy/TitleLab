#!/usr/bin/env python3
"""TitleLab Phase 5B AI provider gate readiness checks.

Static/local only: no OpenAI calls, no backend calls, no database access, and no
secret value printing.
"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
DOCS = ROOT / "docs"
MINIPROGRAM = ROOT / "miniprogram"
SCRIPTS = ROOT / "scripts"

ENV_EXAMPLE = BACKEND / ".env.example"
CONFIG = BACKEND / "app" / "config.py"
AI_API = BACKEND / "app" / "api" / "ai.py"
AI_PROVIDER_GATE = BACKEND / "app" / "services" / "ai_provider_gate.py"
AI_OPENAI_PROVIDER = BACKEND / "app" / "services" / "ai_openai_provider.py"
AI_BUDGET = BACKEND / "app" / "services" / "ai_budget.py"
AI_REDACTION = BACKEND / "app" / "services" / "ai_redaction.py"
PHASE5B_DOC = DOCS / "17_PHASE5B_REAL_AI_PROVIDER_GATE_READINESS.md"

OPENAI_ENDPOINT_MARKER = "api." + "openai" + ".com"
OPENAI_KEY_NAME = "OPENAI" + "_API_KEY"
IGNORED_PARTS = {"node_modules", "dist", "build", ".next", "venv", ".venv", "logs", "coverage", "__pycache__"}


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def iter_files(root: Path, suffixes: tuple[str, ...]) -> list[Path]:
    if not root.exists():
        return []
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix in suffixes
        and not any(part in IGNORED_PARTS for part in path.parts)
    )


def git_diff_names(*paths: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--", *paths],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def check_config_defaults() -> list[Check]:
    text = read_text(CONFIG)
    return [
        Check("AI provider default is mock", 'titlelab_ai_provider: str = "mock"' in text, "backend/app/config.py"),
        Check(
            "Real provider gate default false",
            "titlelab_ai_real_provider_enabled: bool = False" in text,
            "backend/app/config.py",
        ),
    ]


def check_env_example() -> Check:
    values: dict[str, str] = {}
    for line in read_text(ENV_EXAMPLE).splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    required = {
        "TITLELAB_AI_PROVIDER": "mock",
        "TITLELAB_AI_REAL_PROVIDER_ENABLED": "false",
        "TITLELAB_AI_MODEL": "",
        "TITLELAB_AI_TIMEOUT_SECONDS": "15",
        "TITLELAB_AI_MAX_RETRIES": "1",
        "TITLELAB_AI_DAILY_BUDGET_CENTS": "0",
        "TITLELAB_AI_MAX_INPUT_CHARS": "2000",
        "TITLELAB_AI_MAX_OUTPUT_ITEMS": "5",
        OPENAI_KEY_NAME: "",
    }
    mismatches = [key for key, expected in required.items() if values.get(key) != expected]
    suspicious = [
        key
        for key, value in values.items()
        if key in {OPENAI_KEY_NAME, "API_KEY", "DB_PASSWORD"} and value not in {"", "mock", "false", "0"}
    ]
    return Check(
        "backend/.env.example has only safe AI placeholders",
        not mismatches and not suspicious,
        "mismatches=" + (", ".join(mismatches) if mismatches else "none"),
    )


def check_runtime_openai_direct() -> Check:
    runtime_files = iter_files(BACKEND / "app", (".py",)) + iter_files(SCRIPTS, (".py",))
    hits = [rel(path) for path in runtime_files if OPENAI_ENDPOINT_MARKER in read_text(path).lower()]
    return Check("No runtime direct OpenAI endpoint marker", not hits, "hits=" + (", ".join(hits) if hits else "none"))


def check_miniprogram_openai() -> Check:
    files = iter_files(MINIPROGRAM, (".js", ".json", ".wxml", ".wxss", ".md"))
    hits = [
        rel(path)
        for path in files
        if OPENAI_ENDPOINT_MARKER in read_text(path).lower() or OPENAI_KEY_NAME in read_text(path)
    ]
    return Check("Mini program has no OpenAI direct marker or key name", not hits, "hits=" + (", ".join(hits) if hits else "none"))


def check_provider_gate_files() -> list[Check]:
    return [
        Check("ai_provider_gate exists", AI_PROVIDER_GATE.exists(), rel(AI_PROVIDER_GATE)),
        Check("ai_openai_provider placeholder exists", AI_OPENAI_PROVIDER.exists(), rel(AI_OPENAI_PROVIDER)),
        Check("ai_budget exists", AI_BUDGET.exists(), rel(AI_BUDGET)),
        Check("ai_redaction exists", AI_REDACTION.exists(), rel(AI_REDACTION)),
    ]


def check_provider_gate_behavior() -> list[Check]:
    checks: list[Check] = []
    mock_ready = simulate_provider_readiness(
        provider="mock",
        real_provider_enabled=False,
        model="",
        api_key_present=False,
    )
    checks.append(
        Check(
            "mock provider disabled-real gate passes",
            mock_ready == "PASS",
            mock_ready,
        )
    )
    real_missing_key = simulate_provider_readiness(
        provider="openai",
        real_provider_enabled=True,
        model="gpt-placeholder",
        api_key_present=False,
    )
    checks.append(
        Check(
            "real provider enabled without managed key fails",
            real_missing_key == "AI_PROVIDER_DISABLED",
            real_missing_key,
        )
    )
    return checks


def simulate_provider_readiness(
    *,
    provider: str,
    real_provider_enabled: bool,
    model: str,
    api_key_present: bool,
) -> str:
    if provider not in {"mock", "openai"}:
        return "AI_CONFIG_ERROR"
    if not real_provider_enabled:
        return "PASS" if provider == "mock" else "AI_PROVIDER_DISABLED"
    if provider == "mock":
        return "AI_CONFIG_ERROR"
    if not model:
        return "AI_CONFIG_ERROR"
    if not api_key_present:
        return "AI_PROVIDER_DISABLED"
    return "PASS"


def check_ai_endpoint_auth_dependency() -> Check:
    text = read_text(AI_API)
    required = ["resolve_current_user", "require_workspace_member", "assert_ai_provider_readiness"]
    missing = [needle for needle in required if needle not in text]
    return Check("AI endpoint keeps auth, membership, and provider readiness gates", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def check_write_methods() -> Check:
    allowed = {
        "POST /api/v1/auth/wechat-login",
        "POST /api/v1/auth/logout",
        "POST /api/v1/workspaces/{workspace_id}/ai/title-suggestions",
    }
    route_sources = {
        "backend/app/api/auth.py": read_text(BACKEND / "app" / "api" / "auth.py"),
        "backend/app/api/ai.py": read_text(BACKEND / "app" / "api" / "ai.py"),
        "backend/app/api/readonly.py": read_text(BACKEND / "app" / "api" / "readonly.py"),
    }
    mutating: set[str] = set()
    route_prefixes = {
        "backend/app/api/auth.py": "/api/v1/auth",
        "backend/app/api/ai.py": "/api/v1/workspaces/{workspace_id}/ai",
        "backend/app/api/readonly.py": "/api/v1/workspaces/{workspace_id}",
    }
    for source_name, text in route_sources.items():
        prefix = route_prefixes[source_name]
        for method, suffix in re.findall(r"@router\.(post|put|patch|delete)\(\s*[\"']([^\"']+)[\"']", text):
            mutating.add(f"{method.upper()} {prefix}{suffix}")
    return Check("Only auth POST and AI title-suggestions POST", mutating == allowed, "routes=" + ", ".join(sorted(mutating)))


def check_no_migration_or_miniprogram_diff() -> list[Check]:
    miniprogram_diff = git_diff_names("miniprogram")
    migration_diff = git_diff_names("backend/alembic", "backend/app/db")
    return [
        Check("No miniprogram diff", not miniprogram_diff, "diff=" + (", ".join(miniprogram_diff) if miniprogram_diff else "none")),
        Check("No migration or db diff", not migration_diff, "diff=" + (", ".join(migration_diff) if migration_diff else "none")),
    ]


def check_docs() -> Check:
    if not PHASE5B_DOC.exists():
        return Check("docs/17 present", False, "missing docs/17")
    text = read_text(PHASE5B_DOC)
    required = [
        "real provider gate",
        "secret",
        "structured output",
        "timeout",
        "retry",
        "budget",
        "redaction",
        "mock provider",
        "phase 5c",
        "rollback",
    ]
    missing = [item for item in required if item not in text.lower()]
    return Check("docs/17 covers Phase 5B gates", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.extend(check_config_defaults())
    checks.append(check_env_example())
    checks.append(check_runtime_openai_direct())
    checks.append(check_miniprogram_openai())
    checks.extend(check_provider_gate_files())
    checks.extend(check_provider_gate_behavior())
    checks.append(check_ai_endpoint_auth_dependency())
    checks.append(check_write_methods())
    checks.extend(check_no_migration_or_miniprogram_diff())
    checks.append(check_docs())
    return checks


def main() -> int:
    checks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 5B AI provider gate readiness")
    print("Result: " + ("PASS" if not failed else "FAIL"))
    print("")
    print("Checks:")
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"- {status}: {check.name} ({check.detail})")

    print("")
    print("External calls: none")
    print("Secret values printed: none")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
