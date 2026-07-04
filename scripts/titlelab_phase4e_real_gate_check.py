#!/usr/bin/env python3
"""TitleLab Phase 4E controlled real gate readiness checks.

Static/local only: no WeChat calls, no backend calls, no database access, and no
secret value printing.
"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINIPROGRAM = ROOT / "miniprogram"
DOCS = ROOT / "docs"

ALLOWED_API_BASE = "https://api.title.mirroroo.top/api/v1"
OPENAI_ENDPOINT_MARKER = "api." + "openai" + ".com"
BLOCKED_PROVIDER_MARKER = "cloud" + "flare"

ENV_PATH = MINIPROGRAM / "config" / "env.js"
REQUEST_PATH = MINIPROGRAM / "services" / "request.js"
WECHAT_ADAPTER_PATH = MINIPROGRAM / "adapters" / "wechat.js"
AUTH_API_PATH = MINIPROGRAM / "services" / "authApi.js"
AUTH_REPOSITORY_PATH = MINIPROGRAM / "services" / "authRepository.js"
CONTENT_REPOSITORY_PATH = MINIPROGRAM / "services" / "contentRepository.js"
REAL_GATE_GUARD_PATH = MINIPROGRAM / "services" / "realGateGuard.js"
PRIVATE_PROJECT_CONFIG = "miniprogram/project.private.config.json"

BANNED_DOMAIN_MARKERS = (
    "api.mirroroo.top",
    "api.num.mirroroo.top",
    "num.mirroroo.top",
    "admin.mirroroo.top",
    "title-api.mirroroo.top",
    "workers.dev",
    "pages.dev",
    BLOCKED_PROVIDER_MARKER,
)


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def js_files() -> list[Path]:
    ignored_parts = {"node_modules", "dist", "build", ".next", "venv", ".venv", "logs", "coverage"}
    return sorted(
        path
        for path in MINIPROGRAM.rglob("*.js")
        if not any(part in ignored_parts for part in path.parts)
    )


def page_js_files() -> list[Path]:
    pages_dir = MINIPROGRAM / "pages"
    return sorted(pages_dir.rglob("*.js")) if pages_dir.exists() else []


def find_occurrences(pattern: str, paths: list[Path], flags: int = re.IGNORECASE | re.MULTILINE) -> list[str]:
    regex = re.compile(pattern, flags=flags)
    return [rel(path) for path in paths if regex.search(read_text(path))]


def git_ls_files(path: str) -> list[str]:
    result = subprocess.run(["git", "ls-files", path], cwd=ROOT, check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def simulated_env_text(*, api_mode: str, real_gate: bool, auth_gate: bool, api_base: str, workspace_id: str) -> str:
    text = read_text(ENV_PATH)
    text = re.sub(r"apiMode:\s*API_MODES\.\w+", f"apiMode: API_MODES.{api_mode}", text)
    text = re.sub(r"realApiGateEnabled:\s*(true|false)", f"realApiGateEnabled: {str(real_gate).lower()}", text)
    text = re.sub(r"authRealApiGateEnabled:\s*(true|false)", f"authRealApiGateEnabled: {str(auth_gate).lower()}", text)
    text = re.sub(r'const API_BASE_URL = `\$\{ALLOWED_API_ORIGIN\}/api/v1`;', f'const API_BASE_URL = "{api_base}";', text)
    text = re.sub(r'const DEFAULT_WORKSPACE_ID = "[^"]*";', f'const DEFAULT_WORKSPACE_ID = "{workspace_id}";', text)
    return text


def extract_runtime_config(env_text: str) -> dict[str, object]:
    api_mode_match = re.search(r"apiMode:\s*API_MODES\.(\w+)", env_text)
    real_gate_match = re.search(r"realApiGateEnabled:\s*(true|false)", env_text)
    auth_gate_match = re.search(r"authRealApiGateEnabled:\s*(true|false)", env_text)
    base_match = re.search(r'const API_BASE_URL = (?:"([^"]+)"|`\$\{ALLOWED_API_ORIGIN\}/api/v1`)', env_text)
    workspace_match = re.search(r'const DEFAULT_WORKSPACE_ID = "([^"]*)"', env_text)
    base_url = base_match.group(1) if base_match and base_match.group(1) else ALLOWED_API_BASE
    return {
        "apiMode": (api_mode_match.group(1).lower() if api_mode_match else "mock"),
        "realApiGateEnabled": real_gate_match.group(1) == "true" if real_gate_match else False,
        "authRealApiGateEnabled": auth_gate_match.group(1) == "true" if auth_gate_match else False,
        "apiBaseUrl": base_url,
        "workspaceId": workspace_match.group(1) if workspace_match else "",
    }


def is_placeholder_workspace_id(workspace_id: object) -> bool:
    value = "" if workspace_id is None else str(workspace_id).strip().lower()
    return value in {"", "default", "placeholder", "demo", "test", "workspace-placeholder", "workspace_id"}


def validate_readiness(config: dict[str, object], *, requires_auth_gate: bool = False, requires_session: bool = False) -> tuple[bool, str]:
    real_gate = config["apiMode"] == "real" and config["realApiGateEnabled"] is True
    auth_gate = real_gate and config["authRealApiGateEnabled"] is True

    if not real_gate:
        return True, "PASS_WITH_RISK" if is_placeholder_workspace_id(config["workspaceId"]) else "PASS"
    if config["apiBaseUrl"] != ALLOWED_API_BASE:
        return False, "INVALID_API_BASE"
    if is_placeholder_workspace_id(config["workspaceId"]):
        return False, "REAL_WORKSPACE_REQUIRED"
    if requires_auth_gate and not auth_gate:
        return False, "AUTH_REAL_API_GATE_CLOSED"
    if auth_gate and requires_session:
        return False, "REAL_AUTH_SESSION_REQUIRED"
    return True, "PASS"


def check_default_gates() -> list[Check]:
    text = read_text(ENV_PATH)
    allowed_base_declared = ALLOWED_API_BASE in text or (
        "https://api.title.mirroroo.top" in text and "/api/v1" in text and "ALLOWED_API_BASE_URL" in text
    )
    return [
        Check("realApiGateEnabled default false", "realApiGateEnabled: false" in text, "env default remains false"),
        Check("authRealApiGateEnabled default false", "authRealApiGateEnabled: false" in text, "auth env default remains false"),
        Check("allowed api base declared", allowed_base_declared, f"allowed={ALLOWED_API_BASE}"),
    ]


def check_guard_exports() -> Check:
    text = read_text(REAL_GATE_GUARD_PATH)
    required = [
        "validateRealApiReadiness",
        "assertRealApiReadiness",
        "isPlaceholderWorkspaceId",
        "normalizeGateError",
    ]
    missing = [name for name in required if name not in text]
    return Check("realGateGuard exports required API", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def check_runtime_uses_guard() -> list[Check]:
    request_text = read_text(REQUEST_PATH)
    auth_text = read_text(AUTH_REPOSITORY_PATH)
    content_text = read_text(CONTENT_REPOSITORY_PATH)
    return [
        Check("request.js calls realGateGuard before real request", "assertRealApiReadiness" in request_text, "request guard call present"),
        Check("authRepository fail-fast before wx.login", "assertRealApiReadiness" in auth_text and "wechat.login()" in auth_text, "auth guard call present"),
        Check("contentRepository validates workspace readiness", "assertContentReadiness" in content_text, "content guard call present"),
    ]


def check_simulated_gates() -> list[Check]:
    gate_off_default = extract_runtime_config(
        simulated_env_text(api_mode="MOCK", real_gate=False, auth_gate=False, api_base=ALLOWED_API_BASE, workspace_id="default")
    )
    gate_on_default = extract_runtime_config(
        simulated_env_text(api_mode="REAL", real_gate=True, auth_gate=False, api_base=ALLOWED_API_BASE, workspace_id="default")
    )
    gate_on_bad_base = extract_runtime_config(
        simulated_env_text(api_mode="REAL", real_gate=True, auth_gate=False, api_base="https://api.mirroroo.top/api/v1", workspace_id="workspace-a")
    )
    auth_gate_no_session = extract_runtime_config(
        simulated_env_text(api_mode="REAL", real_gate=True, auth_gate=True, api_base=ALLOWED_API_BASE, workspace_id="workspace-a")
    )

    off_ok, off_code = validate_readiness(gate_off_default)
    default_ok, default_code = validate_readiness(gate_on_default)
    bad_base_ok, bad_base_code = validate_readiness(gate_on_bad_base)
    auth_ok, auth_code = validate_readiness(auth_gate_no_session, requires_auth_gate=True, requires_session=True)

    return [
        Check("gate off + default workspaceId passes with risk", off_ok and off_code == "PASS_WITH_RISK", off_code),
        Check("gate on + default workspaceId fails", (not default_ok) and default_code == "REAL_WORKSPACE_REQUIRED", default_code),
        Check("gate on + invalid baseUrl fails", (not bad_base_ok) and bad_base_code == "INVALID_API_BASE", bad_base_code),
        Check("auth gate on + missing session readiness fails", (not auth_ok) and auth_code == "REAL_AUTH_SESSION_REQUIRED", auth_code),
    ]


def check_domain_and_platform_calls() -> list[Check]:
    runtime_paths = js_files() + [MINIPROGRAM / "project.config.json", MINIPROGRAM / "app.json"]
    runtime_text_by_path = {path: read_text(path).lower() for path in runtime_paths if path.exists()}
    banned_hits = [
        rel(path)
        for path, text in runtime_text_by_path.items()
        if any(marker in text for marker in BANNED_DOMAIN_MARKERS)
    ]
    openai_hits = [rel(path) for path, text in runtime_text_by_path.items() if OPENAI_ENDPOINT_MARKER in text]
    page_request_hits = find_occurrences(r"\bwx\.request\b", page_js_files())
    page_login_hits = find_occurrences(r"\bwx\.login\b", page_js_files())
    request_hits = find_occurrences(r"\bwx\.request\b", js_files())
    login_hits = find_occurrences(r"\bwx\.login\b", js_files())
    return [
        Check("no banned domain markers in runtime files", not banned_hits, "hits=" + (", ".join(banned_hits) if banned_hits else "none")),
        Check("no direct OpenAI endpoint in runtime files", not openai_hits, "hits=" + (", ".join(openai_hits) if openai_hits else "none")),
        Check("pages do not call wx.request", not page_request_hits, "hits=" + (", ".join(page_request_hits) if page_request_hits else "none")),
        Check("pages do not call wx.login", not page_login_hits, "hits=" + (", ".join(page_login_hits) if page_login_hits else "none")),
        Check("wx.request only in services/request.js", sorted(request_hits) == [rel(REQUEST_PATH)], "hits=" + (", ".join(request_hits) if request_hits else "none")),
        Check("wx.login only in adapters/wechat.js", sorted(login_hits) == [rel(WECHAT_ADAPTER_PATH)], "hits=" + (", ".join(login_hits) if login_hits else "none")),
    ]


def check_write_methods() -> Check:
    post_hits = find_occurrences(r"\brequest\.post\s*\(", js_files())
    unexpected_post = [path for path in post_hits if path != rel(AUTH_API_PATH)]
    mutating_hits = find_occurrences(
        r"\brequest\.(put|patch|delete)\s*\(|method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']|\b(PUT|PATCH|DELETE)\b",
        js_files(),
    )
    passed = not unexpected_post and not mutating_hits
    detail = f"post_hits={post_hits or ['none']}; mutating_hits={mutating_hits or ['none']}"
    return Check("only auth POST and no PUT/PATCH/DELETE", passed, detail)


def check_private_config() -> Check:
    tracked = git_ls_files(PRIVATE_PROJECT_CONFIG)
    return Check("project.private.config.json not tracked", not tracked, "tracked=" + ("yes" if tracked else "no"))


def check_docs() -> Check:
    docs_path = DOCS / "15_PHASE4E_CONTROLLED_REAL_GATE_READINESS.md"
    if not docs_path.exists():
        return Check("docs/15 present", False, "missing docs/15")
    text = read_text(docs_path)
    required = [
        "Controlled real gate",
        "workspaceId",
        "realApiGateEnabled",
        "authRealApiGateEnabled",
        "回滚",
        "不部署",
        "不上传",
        "不提审",
        "OpenAI",
    ]
    missing = [item for item in required if item not in text]
    return Check("docs/15 covers Phase 4E gates", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.extend(check_default_gates())
    checks.append(check_guard_exports())
    checks.extend(check_runtime_uses_guard())
    checks.extend(check_simulated_gates())
    checks.extend(check_domain_and_platform_calls())
    checks.append(check_write_methods())
    checks.append(check_private_config())
    checks.append(check_docs())
    return checks


def main() -> int:
    checks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 4E controlled real gate readiness")
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
