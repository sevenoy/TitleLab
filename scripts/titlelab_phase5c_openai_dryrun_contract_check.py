#!/usr/bin/env python3
"""TitleLab Phase 5C OpenAI provider dry-run contract checks.

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
AI_OPENAI_CONTRACT = BACKEND / "app" / "services" / "ai_openai_contract.py"
AI_OPENAI_PROVIDER = BACKEND / "app" / "services" / "ai_openai_provider.py"
AI_USAGE_ESTIMATOR = BACKEND / "app" / "services" / "ai_usage_estimator.py"
AI_PROVIDER_GATE = BACKEND / "app" / "services" / "ai_provider_gate.py"
PHASE5B_PREFLIGHT = SCRIPTS / "titlelab_phase5b_ai_provider_gate_check.py"
PHASE5C_DOC = DOCS / "18_PHASE5C_OPENAI_PROVIDER_DRYRUN_CONTRACT.md"

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


def run_phase5b_preflight() -> Check:
    result = subprocess.run(
        [sys.executable, str(PHASE5B_PREFLIGHT)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return Check("Phase 5B preflight still passes", result.returncode == 0, f"returncode={result.returncode}")


def parse_env_example() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in read_text(ENV_EXAMPLE).splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def check_config_defaults() -> list[Check]:
    text = read_text(CONFIG)
    return [
        Check("AI provider default is mock", 'titlelab_ai_provider: str = "mock"' in text, rel(CONFIG)),
        Check(
            "Real provider gate default false",
            "titlelab_ai_real_provider_enabled: bool = False" in text,
            rel(CONFIG),
        ),
        Check(
            "OpenAI dry-run gate default false",
            "titlelab_ai_openai_dryrun_enabled: bool = False" in text,
            rel(CONFIG),
        ),
    ]


def check_env_example() -> Check:
    values = parse_env_example()
    required = {
        "TITLELAB_AI_PROVIDER": "mock",
        "TITLELAB_AI_REAL_PROVIDER_ENABLED": "false",
        "TITLELAB_AI_OPENAI_DRYRUN_ENABLED": "false",
        "TITLELAB_AI_MODEL": "",
        "TITLELAB_AI_PROMPT_CACHE_KEY_PREFIX": "",
        OPENAI_KEY_NAME: "",
    }
    mismatches = [key for key, expected in required.items() if values.get(key) != expected]
    suspicious = [
        key
        for key, value in values.items()
        if key in {OPENAI_KEY_NAME, "API_KEY", "DB_PASSWORD"} and value not in {"", "mock", "false", "0"}
    ]
    return Check(
        "backend/.env.example has only safe Phase 5C placeholders",
        not mismatches and not suspicious,
        "mismatches=" + (", ".join(mismatches) if mismatches else "none"),
    )


def check_contract_files() -> list[Check]:
    files = [AI_OPENAI_CONTRACT, AI_OPENAI_PROVIDER, AI_USAGE_ESTIMATOR, AI_PROVIDER_GATE]
    return [Check(f"{rel(path)} exists", path.exists(), rel(path)) for path in files]


def check_contract_capabilities() -> list[Check]:
    text = read_text(AI_OPENAI_CONTRACT)
    required = [
        "build_openai_title_suggestion_request",
        "build_structured_output_schema",
        "normalize_openai_structured_response",
        "map_openai_error",
        "estimate_openai_usage",
        "build_prompt_cache_friendly_messages",
        "redact_openai_audit_payload",
        "FakeOpenAITransport",
        "AI_PROVIDER_SCHEMA_MISMATCH",
        "AI_PROVIDER_TIMEOUT",
        "AI_PROVIDER_RATE_LIMITED",
    ]
    missing = [item for item in required if item not in text]
    return [
        Check("OpenAI dry-run contract exposes required helpers", not missing, "missing=" + (", ".join(missing) if missing else "none"))
    ]


def check_tests_present() -> list[Check]:
    test_files = [
        BACKEND / "tests" / "test_ai_openai_dryrun_contract.py",
        BACKEND / "tests" / "test_ai_structured_output_contract.py",
    ]
    checks = [Check(f"{rel(path)} exists", path.exists(), rel(path)) for path in test_files]
    combined = "\n".join(read_text(path) for path in test_files if path.exists())
    required = {
        "fake transport tests": "FakeOpenAITransport",
        "schema mismatch tests": "schema_mismatch",
        "rate limit tests": "rate_limit",
        "timeout tests": "timeout",
        "prompt cache tests": "prompt_cache",
        "redacted audit tests": "redacted_audit",
    }
    checks.extend(
        Check(name, needle in combined, f"needle={needle}") for name, needle in required.items()
    )
    return checks


def check_runtime_openai_direct() -> Check:
    runtime_files = iter_files(BACKEND / "app", (".py",)) + iter_files(SCRIPTS, (".py",))
    hits = [rel(path) for path in runtime_files if OPENAI_ENDPOINT_MARKER in read_text(path).lower()]
    return Check("No runtime direct OpenAI endpoint marker", not hits, "hits=" + (", ".join(hits) if hits else "none"))


def check_openai_sdk_dependency() -> Check:
    dependency_files = [ROOT / "pyproject.toml", BACKEND / "pyproject.toml"]
    dependency_files.extend(ROOT.glob("requirements*.txt"))
    dependency_files.extend(BACKEND.glob("requirements*.txt"))
    hits = [
        rel(path)
        for path in dependency_files
        if path.exists() and re.search(r"(^|\n)\s*openai\s*([<=>]|\n|$)", read_text(path), flags=re.IGNORECASE)
    ]
    return Check("No OpenAI SDK dependency added", not hits, "hits=" + (", ".join(hits) if hits else "none"))


def check_miniprogram_openai() -> Check:
    files = iter_files(MINIPROGRAM, (".js", ".json", ".wxml", ".wxss", ".md"))
    hits = [
        rel(path)
        for path in files
        if OPENAI_ENDPOINT_MARKER in read_text(path).lower() or OPENAI_KEY_NAME in read_text(path)
    ]
    return Check("Mini program has no OpenAI direct marker or key name", not hits, "hits=" + (", ".join(hits) if hits else "none"))


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


def check_no_forbidden_diff() -> list[Check]:
    miniprogram_diff = git_diff_names("miniprogram")
    migration_diff = git_diff_names("backend/alembic", "backend/app/db")
    dependency_diff = git_diff_names(
        "pyproject.toml",
        "requirements.txt",
        "requirements-dev.txt",
        "backend/pyproject.toml",
        "backend/requirements.txt",
        "backend/requirements-dev.txt",
    )
    return [
        Check("No miniprogram diff", not miniprogram_diff, "diff=" + (", ".join(miniprogram_diff) if miniprogram_diff else "none")),
        Check("No migration or db diff", not migration_diff, "diff=" + (", ".join(migration_diff) if migration_diff else "none")),
        Check("No dependency diff", not dependency_diff, "diff=" + (", ".join(dependency_diff) if dependency_diff else "none")),
    ]


def check_no_real_secret_markers() -> Check:
    files = (
        iter_files(BACKEND, (".py", ".md", ".example", ".toml"))
        + iter_files(DOCS, (".md", ".py"))
        + iter_files(SCRIPTS, (".py", ".md"))
    )
    secret_patterns = [
        re.compile((OPENAI_KEY_NAME + r"=sk-[A-Za-z0-9_\-]{8,}")),
        re.compile(("API" + r"_KEY=[A-Za-z0-9_\-]{20,}")),
        re.compile(("DB" + r"_PASSWORD=")),
        re.compile(("DATABASE" + r"_URL=postgres"), re.IGNORECASE),
        re.compile(("BEGIN PRIVATE" + r" KEY")),
    ]
    hits = []
    for path in files:
        text = read_text(path)
        if any(pattern.search(text) for pattern in secret_patterns):
            hits.append(rel(path))
    return Check("No real secret-looking values in checked files", not hits, "hits=" + (", ".join(sorted(set(hits))) if hits else "none"))


def check_docs() -> Check:
    if not PHASE5C_DOC.exists():
        return Check("docs/18 present", False, "missing docs/18")
    text = read_text(PHASE5C_DOC)
    required = [
        "dry-run",
        "fake transport",
        "structured outputs",
        "prompt caching",
        "usage",
        "error mapping",
        "redaction",
        "requestId",
        "真实 API key",
        "future Phase 5D",
    ]
    missing = [item for item in required if item.lower() not in text.lower()]
    return Check("docs/18 covers Phase 5C contract", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.append(run_phase5b_preflight())
    checks.extend(check_config_defaults())
    checks.append(check_env_example())
    checks.extend(check_contract_files())
    checks.extend(check_contract_capabilities())
    checks.extend(check_tests_present())
    checks.append(check_runtime_openai_direct())
    checks.append(check_openai_sdk_dependency())
    checks.append(check_miniprogram_openai())
    checks.append(check_ai_endpoint_auth_dependency())
    checks.append(check_write_methods())
    checks.extend(check_no_forbidden_diff())
    checks.append(check_no_real_secret_markers())
    checks.append(check_docs())
    return checks


def main() -> int:
    checks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 5C OpenAI provider dry-run contract")
    print("Result: " + ("PASS" if not failed else "FAIL"))
    print("")
    print("Checks:")
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"- {status}: {check.name} ({check.detail})")

    print("")
    print("External calls: none")
    print("Database connections: none")
    print("Secret values printed: none")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
