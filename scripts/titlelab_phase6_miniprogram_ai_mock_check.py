#!/usr/bin/env python3
"""TitleLab Phase 6 mini program AI mock-only checks.

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
REQUEST_PATH = MINIPROGRAM / "services" / "request.js"
WECHAT_ADAPTER_PATH = MINIPROGRAM / "adapters" / "wechat.js"
AI_API_PATH = MINIPROGRAM / "services" / "aiApi.js"
AI_REPOSITORY_PATH = MINIPROGRAM / "services" / "aiRepository.js"
AI_MOCK_PATH = MINIPROGRAM / "services" / "aiMock.js"
AI_NORMALIZER_PATH = MINIPROGRAM / "services" / "aiResultNormalizer.js"
AI_PAGE_DIR = MINIPROGRAM / "pages" / "ai"
APP_JSON = MINIPROGRAM / "app.json"
PHASE6_DOC = DOCS / "21_PHASE6_MINIPROGRAM_AI_TITLE_MOCK_ONLY.md"
HANDOFF = DOCS / "08_HANDOFF.md"
README = MINIPROGRAM / "README.md"

OPENAI_ENDPOINT_MARKER = "api." + "openai" + ".com"
OPENAI_KEY_NAME = "OPENAI" + "_API_KEY"
AI_ENDPOINT = "/ai/title-suggestions"
PRIVATE_PROJECT_CONFIG = "miniprogram/project.private.config.json"
IGNORED_PARTS = {"node_modules", "dist", "build", ".next", "venv", ".venv", "logs", "coverage", "__pycache__"}
SECRET_MARKERS = [
    "App" + "Secret=",
    "API" + "_KEY=",
    "DB" + "_PASSWORD=",
    "Authorization" + ": Bearer",
    "cookie" + "=",
    "password" + "=",
    "BEGIN PRIVATE" + " KEY",
]
ALLOWED_PHASE6_MINIPROGRAM_DIFF_PREFIXES = {
    "miniprogram/README.md",
    "miniprogram/app.json",
    "miniprogram/config/env.js",
    "miniprogram/pages/ai/",
    "miniprogram/pages/index/index.js",
    "miniprogram/pages/index/index.wxml",
    "miniprogram/pages/index/index.wxss",
    "miniprogram/services/aiApi.js",
    "miniprogram/services/aiMock.js",
    "miniprogram/services/aiRepository.js",
    "miniprogram/services/aiResultNormalizer.js",
    "miniprogram/services/request.js",
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


def is_allowed_phase6_miniprogram_diff(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in ALLOWED_PHASE6_MINIPROGRAM_DIFF_PREFIXES)


def only_legacy_miniprogram_diff_failure(output: str) -> bool:
    failed_lines = [line for line in output.splitlines() if line.startswith("- FAIL:")]
    allowed_fail_prefixes = (
        "- FAIL: No miniprogram diff ",
        "- FAIL: Phase 5B preflight still passes ",
        "- FAIL: Phase 5C preflight still passes ",
    )
    if not failed_lines or any(not line.startswith(allowed_fail_prefixes) for line in failed_lines):
        return False

    diff_names = git_diff_names("miniprogram")
    return bool(diff_names) and all(is_allowed_phase6_miniprogram_diff(path) for path in diff_names)


def check_json_files() -> Check:
    paths = [
        APP_JSON,
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


def check_phase_preflights() -> list[Check]:
    scripts = [
        ("Phase 4D preflight still passes", SCRIPTS / "titlelab_phase4d_preflight_check.py"),
        ("Phase 4E preflight still passes", SCRIPTS / "titlelab_phase4e_real_gate_check.py"),
        ("Phase 5B preflight still passes", SCRIPTS / "titlelab_phase5b_ai_provider_gate_check.py"),
        ("Phase 5C preflight still passes", SCRIPTS / "titlelab_phase5c_openai_dryrun_contract_check.py"),
        ("Phase 5D preflight still passes", SCRIPTS / "titlelab_phase5d_live_openai_smoke_readiness_check.py"),
    ]
    checks = []
    for name, path in scripts:
        result = run_script(path)
        if result.returncode == 0:
            checks.append(Check(name, True, "returncode=0"))
            continue

        legacy_diff_only = path.name.startswith("titlelab_phase5") and only_legacy_miniprogram_diff_failure(result.stdout)
        detail = "returncode=1; active Phase 6 miniprogram diff only" if legacy_diff_only else f"returncode={result.returncode}"
        checks.append(Check(name, legacy_diff_only, detail))
    return checks


def check_routes_and_files() -> list[Check]:
    app = json.loads(read_text(APP_JSON))
    pages = app.get("pages", [])
    required_files = [
        AI_MOCK_PATH,
        AI_API_PATH,
        AI_REPOSITORY_PATH,
        AI_NORMALIZER_PATH,
        AI_PAGE_DIR / "index.js",
        AI_PAGE_DIR / "index.json",
        AI_PAGE_DIR / "index.wxml",
        AI_PAGE_DIR / "index.wxss",
        PHASE6_DOC,
    ]
    missing = [path for path in required_files if not path.exists()]
    return [
        Check("AI page route registered", "pages/ai/index" in pages, "miniprogram/app.json"),
        Check("Phase 6 files exist", not missing, "missing=" + (", ".join(rel(path) for path in missing) if missing else "none")),
    ]


def check_env_defaults() -> list[Check]:
    text = read_text(ENV_PATH)
    required = {
        "apiMode stays mock": "apiMode: API_MODES.MOCK",
        "realApiGateEnabled default false": "realApiGateEnabled: false",
        "authRealApiGateEnabled default false": "authRealApiGateEnabled: false",
        "aiRealApiGateEnabled default false": "aiRealApiGateEnabled: false",
    }
    return [Check(name, needle in text, rel(ENV_PATH)) for name, needle in required.items()]


def check_ai_service_contract() -> list[Check]:
    api_text = read_text(AI_API_PATH)
    repo_text = read_text(AI_REPOSITORY_PATH)
    mock_text = read_text(AI_MOCK_PATH)
    normalizer_text = read_text(AI_NORMALIZER_PATH)
    return [
        Check("aiApi maps only title suggestions endpoint", "/ai" in api_text and "/title-suggestions" in api_text and "workspaceRoute" in api_text, rel(AI_API_PATH)),
        Check("aiApi uses services/request boundary", 'require("./request")' in api_text and "REQUEST_METHODS.post" in api_text, rel(AI_API_PATH)),
        Check("aiRepository defaults to mock mode", "env.isMockMode()" in repo_text and "aiMock.generateTitleSuggestions" in repo_text, rel(AI_REPOSITORY_PATH)),
        Check("aiRepository fail-fast guards real AI path", "isAiRealApiEnabled" in repo_text and "assertRealApiReadiness" in repo_text, rel(AI_REPOSITORY_PATH)),
        Check("aiMock returns backend-aligned fields", all(item in mock_text for item in ["title", "rationale", "tags", "riskLevel", "score"]), rel(AI_MOCK_PATH)),
        Check("AI result normalizer keeps structured fields", all(item in normalizer_text for item in ["usageEstimate", "warnings", "requestId"]), rel(AI_NORMALIZER_PATH)),
    ]


def check_page_behavior() -> list[Check]:
    text = read_text(AI_PAGE_DIR / "index.js")
    wxml = read_text(AI_PAGE_DIR / "index.wxml")
    required_js = ["onSourceInput", "onGenerate", "onCopyTitle", "onClear"]
    required_wxml = ["textarea", "loading", "error", "suggestions", "复制标题"]
    index_js = read_text(MINIPROGRAM / "pages" / "index" / "index.js")
    index_wxml = read_text(MINIPROGRAM / "pages" / "index" / "index.wxml")
    return [
        Check(
            "AI page JS exposes input/generate/copy/clear",
            all(item in text for item in required_js)
            and has_js_member_call(text, "aiRepository", "generateTitleSuggestions")
            and has_js_member_call(text, "wechat", "setClipboardData"),
            rel(AI_PAGE_DIR / "index.js"),
        ),
        Check("AI page WXML renders form/loading/error/results/copy", all(item in wxml for item in required_wxml), rel(AI_PAGE_DIR / "index.wxml")),
        Check("Index page has AI entry", "onOpenAI" in index_js and "AI 标题生成" in index_wxml, "pages/index"),
    ]


def check_platform_call_boundaries() -> list[Check]:
    pages = page_js_files()
    request_hits = find_occurrences(r"\bwx\.request\b", js_files())
    login_hits = find_occurrences(r"\bwx\.login\b", js_files())
    page_request_hits = find_occurrences(r"\bwx\.request\b", pages)
    page_login_hits = find_occurrences(r"\bwx\.login\b", pages)
    return [
        Check("wx.request only in services/request.js", sorted(request_hits) == [rel(REQUEST_PATH)], "hits=" + (", ".join(request_hits) if request_hits else "none")),
        Check("wx.login only in adapters/wechat.js", sorted(login_hits) == [rel(WECHAT_ADAPTER_PATH)], "hits=" + (", ".join(login_hits) if login_hits else "none")),
        Check("Pages do not call wx.request", not page_request_hits, "hits=" + (", ".join(page_request_hits) if page_request_hits else "none")),
        Check("Pages do not call wx.login", not page_login_hits, "hits=" + (", ".join(page_login_hits) if page_login_hits else "none")),
    ]


def check_openai_and_secret_markers() -> Check:
    paths = list(MINIPROGRAM.rglob("*"))
    hits = []
    patterns = [OPENAI_ENDPOINT_MARKER, OPENAI_KEY_NAME, *SECRET_MARKERS]
    for path in paths:
        if not path.is_file() or any(part in IGNORED_PARTS for part in path.parts):
            continue
        text = read_text(path)
        lowered = text.lower()
        if OPENAI_ENDPOINT_MARKER in lowered or any(pattern in text for pattern in patterns[1:]):
            hits.append(rel(path))
    return Check("Mini program has no OpenAI direct marker or secret marker", not hits, "hits=" + (", ".join(sorted(set(hits))) if hits else "none"))


def check_write_boundaries() -> list[Check]:
    ai_api_text = read_text(AI_API_PATH)
    post_hits = find_occurrences(r"\brequest\.post\s*\(", js_files())
    mutating_hits = find_occurrences(r"\brequest\.(put|patch|delete)\s*\(|method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']", js_files())
    ai_endpoint_ok = "/ai" in ai_api_text and "/title-suggestions" in ai_api_text and "REQUEST_METHODS.post" in ai_api_text
    return [
        Check("Legacy request.post hits remain auth-only", sorted(post_hits) == ["miniprogram/services/authApi.js"], "hits=" + (", ".join(post_hits) if post_hits else "none")),
        Check("AI endpoint POST is isolated in aiApi", ai_endpoint_ok, rel(AI_API_PATH)),
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
    combined = read_text(PHASE6_DOC) + "\n" + read_text(README) + "\n" + read_text(HANDOFF)
    required = ["Phase 6", "mock-only", "realApiGateEnabled=false", "authRealApiGateEnabled=false", "OpenAI", "AI 标题生成"]
    missing = [item for item in required if item not in combined]
    return Check("docs and README cover Phase 6 AI mock-only", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.extend(check_phase_preflights())
    checks.append(check_json_files())
    checks.extend(check_routes_and_files())
    checks.extend(check_env_defaults())
    checks.extend(check_ai_service_contract())
    checks.extend(check_page_behavior())
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

    print("TitleLab Phase 6 mini program AI title mock-only")
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
