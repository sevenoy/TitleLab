#!/usr/bin/env python3
"""TitleLab Phase 4D real-auth preflight checks.

This script is intentionally static and local-only. It does not call WeChat,
TitleLab APIs, OpenAI, databases, or private dashboards.
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

ALLOWED_API_ORIGIN = "https://api.title.mirroroo.top"
ALLOWED_API_BASE = f"{ALLOWED_API_ORIGIN}/api/v1"
OPENAI_ENDPOINT_MARKER = "api." + "openai" + ".com"
BLOCKED_PROVIDER_MARKER = "cloud" + "flare"

ENV_PATH = MINIPROGRAM / "config" / "env.js"
REQUEST_PATH = MINIPROGRAM / "services" / "request.js"
WECHAT_ADAPTER_PATH = MINIPROGRAM / "adapters" / "wechat.js"
AUTH_API_PATH = MINIPROGRAM / "services" / "authApi.js"
SESSION_STORE_PATH = MINIPROGRAM / "services" / "sessionStore.js"
MINIPROGRAM_README_PATH = MINIPROGRAM / "README.md"
HANDOFF_PATH = DOCS / "08_HANDOFF.md"

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
    ignored_parts = {
        "node_modules",
        "dist",
        "build",
        ".next",
        "venv",
        ".venv",
        "logs",
        "coverage",
    }
    return sorted(
        path
        for path in MINIPROGRAM.rglob("*.js")
        if not any(part in ignored_parts for part in path.parts)
    )


def page_js_files() -> list[Path]:
    pages_dir = MINIPROGRAM / "pages"
    if not pages_dir.exists():
        return []
    return sorted(pages_dir.rglob("*.js"))


def contains(path: Path, pattern: str) -> bool:
    return re.search(pattern, read_text(path), flags=re.IGNORECASE | re.MULTILINE) is not None


def find_occurrences(pattern: str, paths: list[Path]) -> list[str]:
    matches: list[str] = []
    regex = re.compile(pattern, flags=re.IGNORECASE | re.MULTILINE)
    for path in paths:
        if regex.search(read_text(path)):
            matches.append(rel(path))
    return matches


def git_ls_files(path: str) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", path],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def check_real_api_gate_default() -> Check:
    passed = contains(ENV_PATH, r"realApiGateEnabled\s*:\s*false")
    return Check(
        "realApiGateEnabled default false",
        passed,
        "miniprogram/config/env.js keeps realApiGateEnabled=false",
    )


def check_auth_real_api_gate_default() -> Check:
    passed = contains(ENV_PATH, r"authRealApiGateEnabled\s*:\s*false")
    return Check(
        "authRealApiGateEnabled default false",
        passed,
        "miniprogram/config/env.js keeps authRealApiGateEnabled=false",
    )


def check_api_base() -> Check:
    env_text = read_text(ENV_PATH)
    has_origin = ALLOWED_API_ORIGIN in env_text
    has_api_v1 = "/api/v1" in env_text
    runtime_text = "\n".join(read_text(path) for path in js_files())
    urls = sorted(set(re.findall(r"https?://[^\"'`\s]+", runtime_text)))
    unexpected_urls = [url for url in urls if not url.startswith(ALLOWED_API_ORIGIN)]
    passed = has_origin and has_api_v1 and not unexpected_urls
    detail = f"allowed base is {ALLOWED_API_BASE}; unexpected runtime urls={len(unexpected_urls)}"
    return Check("API base allowlist", passed, detail)


def check_banned_domain_markers() -> Check:
    paths = js_files() + [MINIPROGRAM / "project.config.json", MINIPROGRAM / "app.json"]
    hits: list[str] = []
    for path in paths:
        if not path.exists():
            continue
        text = read_text(path).lower()
        if any(marker in text for marker in BANNED_DOMAIN_MARKERS):
            hits.append(rel(path))
    return Check(
        "No banned third-party or foreign domain markers in runtime files",
        not hits,
        "hits=" + (", ".join(hits) if hits else "none"),
    )


def check_no_openai_direct() -> Check:
    hits: list[str] = []
    for path in js_files():
        if OPENAI_ENDPOINT_MARKER in read_text(path).lower():
            hits.append(rel(path))
    return Check(
        "No direct OpenAI endpoint in mini program JS",
        not hits,
        "hits=" + (", ".join(hits) if hits else "none"),
    )


def check_page_platform_calls() -> list[Check]:
    pages = page_js_files()
    request_hits = find_occurrences(r"\bwx\.request\b", pages)
    login_hits = find_occurrences(r"\bwx\.login\b", pages)
    return [
        Check("Pages do not call wx.request", not request_hits, "hits=" + (", ".join(request_hits) if request_hits else "none")),
        Check("Pages do not call wx.login", not login_hits, "hits=" + (", ".join(login_hits) if login_hits else "none")),
    ]


def check_wx_call_allowlist() -> list[Check]:
    request_hits = find_occurrences(r"\bwx\.request\b", js_files())
    login_hits = find_occurrences(r"\bwx\.login\b", js_files())
    request_ok = sorted(request_hits) == [rel(REQUEST_PATH)]
    login_ok = sorted(login_hits) == [rel(WECHAT_ADAPTER_PATH)]
    return [
        Check("wx.request only in services/request.js", request_ok, "hits=" + (", ".join(request_hits) if request_hits else "none")),
        Check("wx.login only in adapters/wechat.js", login_ok, "hits=" + (", ".join(login_hits) if login_hits else "none")),
    ]


def check_auth_post_allowlist() -> Check:
    auth_text = read_text(AUTH_API_PATH)
    required_calls = [
        'request.post("/auth/wechat-login"',
        'request.post("/auth/logout"',
    ]
    missing = [call for call in required_calls if call not in auth_text]
    post_call_hits: list[str] = []
    regex = re.compile(r"\brequest\.post\s*\(")
    for path in js_files():
        if regex.search(read_text(path)):
            post_call_hits.append(rel(path))
    unexpected = [path for path in post_call_hits if path != rel(AUTH_API_PATH)]
    passed = not missing and not unexpected
    detail = "request.post hits=" + (", ".join(post_call_hits) if post_call_hits else "none")
    if missing:
        detail += "; missing allowed auth calls"
    if unexpected:
        detail += "; unexpected=" + ", ".join(unexpected)
    return Check("POST calls limited to authApi wechat-login/logout", passed, detail)


def check_no_mutating_business_methods() -> Check:
    hits = find_occurrences(
        r"\brequest\.(put|patch|delete)\s*\(|method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']|\b(PUT|PATCH|DELETE)\b",
        js_files(),
    )
    return Check("No PUT/PATCH/DELETE in mini program JS", not hits, "hits=" + (", ".join(hits) if hits else "none"))


def check_private_project_config_not_tracked() -> Check:
    tracked = git_ls_files("miniprogram/project.private.config.json")
    return Check(
        "project.private.config.json not tracked",
        not tracked,
        "tracked=" + ("yes" if tracked else "no"),
    )


def check_session_key_namespace() -> Check:
    text = read_text(SESSION_STORE_PATH)
    match = re.search(r"STORAGE_KEYS\s*=\s*\{(?P<body>.*?)\};", text, flags=re.DOTALL)
    values = re.findall(r':\s*"([^"]+)"', match.group("body") if match else "")
    invalid = [value for value in values if not value.startswith("titlelab.")]
    passed = bool(values) and not invalid
    detail = f"keys={len(values)}; invalid_namespace={len(invalid)}"
    return Check("Session storage keys use titlelab namespace", passed, detail)


def workspace_placeholder_risks() -> list[str]:
    text = read_text(ENV_PATH)
    match = re.search(r"DEFAULT_WORKSPACE_ID\s*=\s*[\"']([^\"']*)[\"']", text)
    value = match.group(1).strip() if match else ""
    if value.lower() in {"", "default", "placeholder", "workspace-placeholder", "workspace_id"}:
        return [f"workspaceId uses placeholder value '{value or '<empty>'}' and must be replaced before real traffic"]
    return []


def check_readme_handoff_gate_text() -> Check:
    readme_text = read_text(MINIPROGRAM_README_PATH)
    handoff_text = read_text(HANDOFF_PATH)
    needles = ("realApiGateEnabled=false", "authRealApiGateEnabled=false")
    readme_ok = all(needle in readme_text for needle in needles)
    handoff_ok = all(needle in handoff_text for needle in needles)
    return Check(
        "README and handoff document closed real gates",
        readme_ok and handoff_ok,
        f"miniprogram README={'ok' if readme_ok else 'missing'}; handoff={'ok' if handoff_ok else 'missing'}",
    )


def run_checks() -> tuple[list[Check], list[str]]:
    checks: list[Check] = [
        check_real_api_gate_default(),
        check_auth_real_api_gate_default(),
        check_api_base(),
        check_banned_domain_markers(),
        check_no_openai_direct(),
        check_auth_post_allowlist(),
        check_no_mutating_business_methods(),
        check_private_project_config_not_tracked(),
        check_session_key_namespace(),
        check_readme_handoff_gate_text(),
    ]
    checks.extend(check_page_platform_calls())
    checks.extend(check_wx_call_allowlist())
    return checks, workspace_placeholder_risks()


def main() -> int:
    checks, risks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 4D real-auth preflight")
    print("Result: " + ("PASS" if not failed else "FAIL"))
    print("")
    print("Checks:")
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"- {status}: {check.name} ({check.detail})")

    print("")
    print("Risk items:")
    if risks:
        for risk in risks:
            print(f"- RISK: {risk}")
    else:
        print("- none")

    print("")
    print("External calls: none")
    print("Secret values printed: none")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
