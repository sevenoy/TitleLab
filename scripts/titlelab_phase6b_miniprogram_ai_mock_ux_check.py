#!/usr/bin/env python3
"""TitleLab Phase 6B mini program AI mock UX checks.

Static/local only: no backend calls, no OpenAI calls, no WeChat calls, no
database access, and no secret value printing.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINIPROGRAM = ROOT / "miniprogram"
DOCS = ROOT / "docs"
SCRIPTS = ROOT / "scripts"

ENV_PATH = MINIPROGRAM / "config" / "env.js"
AI_PAGE_DIR = MINIPROGRAM / "pages" / "ai"
AI_PAGE_JS = AI_PAGE_DIR / "index.js"
AI_PAGE_WXML = AI_PAGE_DIR / "index.wxml"
AI_PAGE_WXSS = AI_PAGE_DIR / "index.wxss"
AI_MOCK_PATH = MINIPROGRAM / "services" / "aiMock.js"
AI_REPOSITORY_PATH = MINIPROGRAM / "services" / "aiRepository.js"
REQUEST_PATH = MINIPROGRAM / "services" / "request.js"
WECHAT_ADAPTER_PATH = MINIPROGRAM / "adapters" / "wechat.js"
PHASE6B_DOC = DOCS / "22_PHASE6B_MINIPROGRAM_AI_MOCK_UX_QA_HARDENING.md"
README = MINIPROGRAM / "README.md"
HANDOFF = DOCS / "08_HANDOFF.md"
PRIVATE_PROJECT_CONFIG = "miniprogram/project.private.config.json"

OPENAI_ENDPOINT_MARKER = "api." + "openai" + ".com"
OPENAI_KEY_NAME = "OPENAI" + "_API_KEY"
SECRET_MARKERS = [
    "App" + "Secret=",
    "API" + "_KEY=",
    "DB" + "_PASSWORD=",
    "Authorization" + ": Bearer",
    "cookie" + "=",
    "password" + "=",
    "BEGIN PRIVATE" + " KEY",
]
IGNORED_PARTS = {"node_modules", "dist", "build", ".next", "venv", ".venv", "logs", "coverage", "__pycache__"}
ALLOWED_PHASE6B_MINIPROGRAM_DIFF_PREFIXES = {
    "miniprogram/README.md",
    "miniprogram/config/env.js",
    "miniprogram/pages/ai/",
    "miniprogram/pages/index/index.wxml",
    "miniprogram/pages/index/index.wxss",
    "miniprogram/services/aiMock.js",
    "miniprogram/services/aiRepository.js",
}


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
    return sorted(
        path
        for path in MINIPROGRAM.rglob("*.js")
        if path.is_file() and not any(part in IGNORED_PARTS for part in path.parts)
    )


def page_js_files() -> list[Path]:
    pages_dir = MINIPROGRAM / "pages"
    return sorted(pages_dir.rglob("*.js")) if pages_dir.exists() else []


def find_occurrences(pattern: str, paths: list[Path], flags: int = re.IGNORECASE | re.MULTILINE) -> list[str]:
    regex = re.compile(pattern, flags=flags)
    return [rel(path) for path in paths if regex.search(read_text(path))]


def has_js_member_call(text: str, object_name: str, method_name: str) -> bool:
    return bool(re.search(rf"\b{re.escape(object_name)}\s*\.\s*{re.escape(method_name)}\b", text))


def git_diff_names(*paths: str) -> list[str]:
    result = subprocess.run(["git", "diff", "--name-only", "--", *paths], cwd=ROOT, check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def git_ls_files(path: str) -> list[str]:
    result = subprocess.run(["git", "ls-files", path], cwd=ROOT, check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def run_script(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(path)], cwd=ROOT, text=True, capture_output=True, check=False)


def is_allowed_phase6b_miniprogram_diff(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in ALLOWED_PHASE6B_MINIPROGRAM_DIFF_PREFIXES)


def only_active_phase6b_miniprogram_diff_failure(output: str) -> bool:
    failed_lines = [line for line in output.splitlines() if line.startswith("- FAIL:")]
    allowed_fail_prefixes = (
        "- FAIL: No miniprogram diff ",
        "- FAIL: Phase 5B preflight still passes ",
        "- FAIL: Phase 5C preflight still passes ",
    )
    if not failed_lines or any(not line.startswith(allowed_fail_prefixes) for line in failed_lines):
        return False

    diff_names = git_diff_names("miniprogram")
    return bool(diff_names) and all(is_allowed_phase6b_miniprogram_diff(path) for path in diff_names)


def check_phase_preflights() -> list[Check]:
    scripts = [
        ("Phase 4D preflight still passes", SCRIPTS / "titlelab_phase4d_preflight_check.py"),
        ("Phase 4E preflight still passes", SCRIPTS / "titlelab_phase4e_real_gate_check.py"),
        ("Phase 5B preflight still passes", SCRIPTS / "titlelab_phase5b_ai_provider_gate_check.py"),
        ("Phase 5C preflight still passes", SCRIPTS / "titlelab_phase5c_openai_dryrun_contract_check.py"),
        ("Phase 5D preflight still passes", SCRIPTS / "titlelab_phase5d_live_openai_smoke_readiness_check.py"),
        ("Phase 6 preflight still passes", SCRIPTS / "titlelab_phase6_miniprogram_ai_mock_check.py"),
    ]
    checks: list[Check] = []
    for name, path in scripts:
        result = run_script(path)
        if result.returncode == 0:
            checks.append(Check(name, True, "returncode=0"))
            continue

        diff_only = only_active_phase6b_miniprogram_diff_failure(result.stdout)
        detail = "returncode=1; active Phase 6B miniprogram diff only" if diff_only else f"returncode={result.returncode}"
        checks.append(Check(name, diff_only, detail))
    return checks


def check_json_files() -> Check:
    paths = [
        MINIPROGRAM / "app.json",
        MINIPROGRAM / "project.config.json",
        MINIPROGRAM / "sitemap.json",
        MINIPROGRAM / "pages" / "index" / "index.json",
        MINIPROGRAM / "pages" / "detail" / "detail.json",
        AI_PAGE_DIR / "index.json",
    ]
    failed: list[str] = []
    for path in paths:
        try:
            json.loads(read_text(path))
        except Exception:
            failed.append(rel(path))
    return Check("Mini program JSON files parse", not failed, "failed=" + (", ".join(failed) if failed else "none"))


def check_env_defaults() -> list[Check]:
    text = read_text(ENV_PATH)
    required = {
        "apiMode stays mock": "apiMode: API_MODES.MOCK",
        "realApiGateEnabled default false": "realApiGateEnabled: false",
        "authRealApiGateEnabled default false": "authRealApiGateEnabled: false",
        "aiRealApiGateEnabled default false": "aiRealApiGateEnabled: false",
        "Phase 6B version label": "phase6b-miniprogram-ai-mock-ux-qa",
    }
    return [Check(name, needle in text, rel(ENV_PATH)) for name, needle in required.items()]


def check_ai_page_ux() -> list[Check]:
    page_js = read_text(AI_PAGE_JS)
    page_wxml = read_text(AI_PAGE_WXML)
    page_wxss = read_text(AI_PAGE_WXSS)
    js_needles = [
        "MAX_SOURCE_LENGTH",
        "MIN_SOURCE_LENGTH",
        "MOCK_EXAMPLES",
        "onUseExample",
        "onCopyAll",
        "onRetry",
        "validateSourceText",
        "sourceLength",
        "canCopyAll",
    ]
    wxml_needles = [
        "mock-notice",
        "preset-row",
        "input-meta",
        "warning-list",
        "复制全部",
        "重新生成",
        "暂无结果",
    ]
    wxss_needles = ["mock-notice", "preset-button", "input-meta", "warning-list", "result-actions"]
    return [
        Check("AI page JS has Phase 6B UX handlers", all(item in page_js for item in js_needles), rel(AI_PAGE_JS)),
        Check("AI page WXML exposes UX controls and states", all(item in page_wxml for item in wxml_needles), rel(AI_PAGE_WXML)),
        Check("AI page WXSS styles UX controls", all(item in page_wxss for item in wxss_needles), rel(AI_PAGE_WXSS)),
        Check(
            "AI page still uses repository and adapter only",
            has_js_member_call(page_js, "aiRepository", "generateTitleSuggestions")
            and has_js_member_call(page_js, "wechat", "setClipboardData"),
            rel(AI_PAGE_JS),
        ),
    ]


def check_ai_mock_quality() -> list[Check]:
    text = read_text(AI_MOCK_PATH)
    required = [
        "MAX_SOURCE_CHARS",
        "SECRET_LIKE_PATTERN",
        "redactSourceText",
        "detectScenario",
        "香港迪士尼旅拍",
        "摄影师跟拍",
        "女生单人写真",
        "情侣 / 求婚",
        "街拍 / 旅拍",
        "SECRET_LIKE_INPUT_REDACTED",
        "titlelab-miniprogram-mock-title-v2",
    ]
    schema_fields = ["title", "rationale", "tags", "riskLevel", "score"]
    return [
        Check("AI mock has Phase 6B stable scenario presets", all(item in text for item in required), rel(AI_MOCK_PATH)),
        Check("AI mock keeps backend-aligned fields", all(item in text for item in schema_fields), rel(AI_MOCK_PATH)),
    ]


def check_repository_errors() -> Check:
    text = read_text(AI_REPOSITORY_PATH)
    required = ["fallbackMessages", "AI_EMPTY_INPUT", "REAL_API_GATE_CLOSED", "NETWORK_ERROR", "Promise.reject(error)"]
    return Check("aiRepository keeps stable display errors and mock rejection", all(item in text for item in required), rel(AI_REPOSITORY_PATH))


def check_platform_call_boundaries() -> list[Check]:
    request_hits = find_occurrences(r"\bwx\.request\b", js_files())
    login_hits = find_occurrences(r"\bwx\.login\b", js_files())
    page_request_hits = find_occurrences(r"\bwx\.request\b", page_js_files())
    page_login_hits = find_occurrences(r"\bwx\.login\b", page_js_files())
    return [
        Check("wx.request only in services/request.js", sorted(request_hits) == [rel(REQUEST_PATH)], "hits=" + (", ".join(request_hits) if request_hits else "none")),
        Check("wx.login only in adapters/wechat.js", sorted(login_hits) == [rel(WECHAT_ADAPTER_PATH)], "hits=" + (", ".join(login_hits) if login_hits else "none")),
        Check("Pages do not call wx.request", not page_request_hits, "hits=" + (", ".join(page_request_hits) if page_request_hits else "none")),
        Check("Pages do not call wx.login", not page_login_hits, "hits=" + (", ".join(page_login_hits) if page_login_hits else "none")),
    ]


def check_openai_and_secret_markers() -> Check:
    hits = []
    patterns = [OPENAI_ENDPOINT_MARKER, OPENAI_KEY_NAME, *SECRET_MARKERS]
    for path in MINIPROGRAM.rglob("*"):
        if not path.is_file() or any(part in IGNORED_PARTS for part in path.parts):
            continue
        text = read_text(path)
        lowered = text.lower()
        if OPENAI_ENDPOINT_MARKER in lowered or any(pattern in text for pattern in patterns[1:]):
            hits.append(rel(path))
    return Check("Mini program has no OpenAI direct marker or secret marker", not hits, "hits=" + (", ".join(sorted(set(hits))) if hits else "none"))


def check_write_boundaries() -> list[Check]:
    post_hits = find_occurrences(r"\brequest\.post\s*\(", js_files())
    mutating_hits = find_occurrences(r"\brequest\.(put|patch|delete)\s*\(|method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']", js_files())
    return [
        Check("Legacy request.post hits remain auth-only", sorted(post_hits) == ["miniprogram/services/authApi.js"], "hits=" + (", ".join(post_hits) if post_hits else "none")),
        Check("No PUT/PATCH/DELETE in mini program JS", not mutating_hits, "hits=" + (", ".join(mutating_hits) if mutating_hits else "none")),
    ]


def check_forbidden_diffs() -> list[Check]:
    backend_diff = git_diff_names("backend/alembic", "backend/app/db", "backend/app/models")
    dependency_diff = git_diff_names("pyproject.toml", "requirements.txt", "requirements-dev.txt", "backend/pyproject.toml")
    return [
        Check("No backend migration/db/models diff", not backend_diff, "diff=" + (", ".join(backend_diff) if backend_diff else "none")),
        Check("No dependency diff", not dependency_diff, "diff=" + (", ".join(dependency_diff) if dependency_diff else "none")),
    ]


def check_private_config() -> Check:
    tracked = git_ls_files(PRIVATE_PROJECT_CONFIG)
    return Check("project.private.config.json not tracked", not tracked, "tracked=" + ("yes" if tracked else "no"))


def check_docs() -> Check:
    if not PHASE6B_DOC.exists():
        return Check("docs/22 present", False, "missing docs/22")
    combined = read_text(PHASE6B_DOC) + "\n" + read_text(README) + "\n" + read_text(HANDOFF)
    required = ["Phase 6B", "mock-only", "copy all", "realApiGateEnabled=false", "authRealApiGateEnabled=false", "AI mock UX"]
    missing = [item for item in required if item not in combined]
    return Check("docs and README cover Phase 6B AI mock UX", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.extend(check_phase_preflights())
    checks.append(check_json_files())
    checks.extend(check_env_defaults())
    checks.extend(check_ai_page_ux())
    checks.extend(check_ai_mock_quality())
    checks.append(check_repository_errors())
    checks.extend(check_platform_call_boundaries())
    checks.append(check_openai_and_secret_markers())
    checks.extend(check_write_boundaries())
    checks.extend(check_forbidden_diffs())
    checks.append(check_private_config())
    checks.append(check_docs())
    return checks


def main() -> int:
    checks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 6B mini program AI mock UX hardening")
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
    print("Live OpenAI calls: none")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
