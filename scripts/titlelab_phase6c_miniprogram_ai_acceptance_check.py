#!/usr/bin/env python3
"""TitleLab Phase 6C mini program AI mock acceptance checks.

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
AI_PAGE_JS = AI_PAGE_DIR / "index.js"
AI_PAGE_WXML = AI_PAGE_DIR / "index.wxml"
AI_PAGE_WXSS = AI_PAGE_DIR / "index.wxss"
INDEX_PAGE_JS = MINIPROGRAM / "pages" / "index" / "index.js"
INDEX_PAGE_WXML = MINIPROGRAM / "pages" / "index" / "index.wxml"
APP_JSON = MINIPROGRAM / "app.json"
PROJECT_CONFIG = MINIPROGRAM / "project.config.json"
PHASE6C_DOC = DOCS / "23_PHASE6C_MINIPROGRAM_AI_MOCK_ACCEPTANCE_QA.md"
README = MINIPROGRAM / "README.md"
HANDOFF = DOCS / "08_HANDOFF.md"

OPENAI_ENDPOINT_MARKER = "api." + "openai" + ".com"
OPENAI_KEY_NAME = "OPENAI" + "_API_KEY"
PRIVATE_PROJECT_CONFIG = "miniprogram/project.private.config.json"
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
ALLOWED_PHASE6C_MINIPROGRAM_DIFF_PREFIXES = {
    "miniprogram/README.md",
    "miniprogram/config/env.js",
    "miniprogram/pages/ai/",
    "miniprogram/pages/index/index.js",
    "miniprogram/pages/index/index.wxml",
    "miniprogram/pages/index/index.wxss",
    "miniprogram/services/aiApi.js",
    "miniprogram/services/aiMock.js",
    "miniprogram/services/aiRepository.js",
    "miniprogram/services/aiResultNormalizer.js",
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


def is_allowed_phase6c_miniprogram_diff(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in ALLOWED_PHASE6C_MINIPROGRAM_DIFF_PREFIXES)


def only_active_phase6c_miniprogram_diff_failure(output: str) -> bool:
    failed_lines = [line for line in output.splitlines() if line.startswith("- FAIL:")]
    allowed_fail_prefixes = (
        "- FAIL: No miniprogram diff ",
        "- FAIL: Phase 5B preflight still passes ",
        "- FAIL: Phase 5C preflight still passes ",
        "- FAIL: Phase 6 preflight still passes ",
        "- FAIL: Phase 6B preflight still passes ",
    )
    if not failed_lines or any(not line.startswith(allowed_fail_prefixes) for line in failed_lines):
        return False

    diff_names = git_diff_names("miniprogram")
    return bool(diff_names) and all(is_allowed_phase6c_miniprogram_diff(path) for path in diff_names)


def check_previous_preflights() -> list[Check]:
    scripts = [
        ("Phase 4D preflight still passes", SCRIPTS / "titlelab_phase4d_preflight_check.py"),
        ("Phase 4E preflight still passes", SCRIPTS / "titlelab_phase4e_real_gate_check.py"),
        ("Phase 5B preflight still passes", SCRIPTS / "titlelab_phase5b_ai_provider_gate_check.py"),
        ("Phase 5C preflight still passes", SCRIPTS / "titlelab_phase5c_openai_dryrun_contract_check.py"),
        ("Phase 5D preflight still passes", SCRIPTS / "titlelab_phase5d_live_openai_smoke_readiness_check.py"),
        ("Phase 6 preflight still passes", SCRIPTS / "titlelab_phase6_miniprogram_ai_mock_check.py"),
        ("Phase 6B preflight still passes", SCRIPTS / "titlelab_phase6b_miniprogram_ai_mock_ux_check.py"),
    ]
    checks: list[Check] = []
    for name, path in scripts:
        result = run_script(path)
        if result.returncode == 0:
            checks.append(Check(name, True, "returncode=0"))
            continue
        diff_only = only_active_phase6c_miniprogram_diff_failure(result.stdout)
        detail = "returncode=1; active Phase 6C miniprogram diff only" if diff_only else f"returncode={result.returncode}"
        checks.append(Check(name, diff_only, detail))
    return checks


def check_json_files() -> Check:
    paths = [
        APP_JSON,
        PROJECT_CONFIG,
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


def check_routes_and_files() -> list[Check]:
    app = json.loads(read_text(APP_JSON))
    pages = app.get("pages", [])
    required_files = [
        AI_PAGE_JS,
        AI_PAGE_DIR / "index.json",
        AI_PAGE_WXML,
        AI_PAGE_WXSS,
        AI_MOCK_PATH,
        AI_API_PATH,
        AI_REPOSITORY_PATH,
        AI_NORMALIZER_PATH,
        PHASE6C_DOC,
    ]
    missing = [path for path in required_files if not path.exists()]
    return [
        Check("AI page route registered", "pages/ai/index" in pages, rel(APP_JSON)),
        Check("AI page four-file bundle exists", all((AI_PAGE_DIR / f"index.{suffix}").exists() for suffix in ["js", "json", "wxml", "wxss"]), rel(AI_PAGE_DIR)),
        Check("AI service/repository/mock/api files exist", not missing, "missing=" + (", ".join(rel(path) for path in missing) if missing else "none")),
    ]


def check_devtools_import_precheck() -> list[Check]:
    project = json.loads(read_text(PROJECT_CONFIG))
    settings = project.get("setting", {})
    tracked_private = git_ls_files(PRIVATE_PROJECT_CONFIG)
    return [
        Check("DevTools import root is miniprogram", APP_JSON.exists() and PROJECT_CONFIG.exists(), "import path=miniprogram/"),
        Check("project.config compileType is miniprogram", project.get("compileType") == "miniprogram", rel(PROJECT_CONFIG)),
        Check("project.config urlCheck stays true", settings.get("urlCheck") is True, rel(PROJECT_CONFIG)),
        Check("project.config has AppID field without secret value", bool(project.get("appid")), rel(PROJECT_CONFIG)),
        Check("project.private.config.json not tracked", not tracked_private, "tracked=" + ("yes" if tracked_private else "no")),
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
        Check("aiApi maps backend AI facade endpoint only", "/ai" in api_text and "/title-suggestions" in api_text and "workspaceRoute" in api_text, rel(AI_API_PATH)),
        Check("aiApi stays behind services/request", 'require("./request")' in api_text and "REQUEST_METHODS.post" in api_text, rel(AI_API_PATH)),
        Check("aiRepository defaults to mock mode", "env.isMockMode()" in repo_text and "aiMock.generateTitleSuggestions" in repo_text, rel(AI_REPOSITORY_PATH)),
        Check("aiRepository fail-fast guards real AI path", "isAiRealApiEnabled" in repo_text and "assertRealApiReadiness" in repo_text, rel(AI_REPOSITORY_PATH)),
        Check("aiMock keeps backend-aligned suggestion fields", all(item in mock_text for item in ["title", "rationale", "tags", "riskLevel", "score"]), rel(AI_MOCK_PATH)),
        Check("AI normalizer keeps usage/warnings/requestId", all(item in normalizer_text for item in ["usageEstimate", "warnings", "requestId"]), rel(AI_NORMALIZER_PATH)),
    ]


def check_ai_acceptance_behavior() -> list[Check]:
    page_js = read_text(AI_PAGE_JS)
    page_wxml = read_text(AI_PAGE_WXML)
    page_wxss = read_text(AI_PAGE_WXSS)
    index_js = read_text(INDEX_PAGE_JS)
    index_wxml = read_text(INDEX_PAGE_WXML)
    required_js = [
        "MAX_SOURCE_LENGTH",
        "MIN_SOURCE_LENGTH",
        "MOCK_EXAMPLES",
        "generateWithPayload",
        "lastPayload",
        "sourceLimitReached",
        "lastGeneratedAt",
        "onCopyAll",
        "onClear",
        "onRetry",
        "validateSourceText",
        "canGenerate",
        "canCopyAll",
        "wechat.showToast",
    ]
    required_wxml = [
        "mock-notice",
        "preset-row",
        "input-meta",
        "limit-reached",
        "disabled=\"{{loading || !canGenerate}}\"",
        "warning-list",
        "复制全部",
        "重新生成",
        "暂无结果",
        "等待输入内容",
        "正在生成 mock 标题",
    ]
    required_wxss = ["mock-notice", "preset-button", "input-meta", "limit-reached", "warning-list", "result-actions"]
    return [
        Check("AI page JS covers acceptance handlers and local state", all(item in page_js for item in required_js), rel(AI_PAGE_JS)),
        Check("AI page WXML covers form/loading/error/empty/results/copy", all(item in page_wxml for item in required_wxml), rel(AI_PAGE_WXML)),
        Check("AI page WXSS covers acceptance states", all(item in page_wxss for item in required_wxss), rel(AI_PAGE_WXSS)),
        Check(
            "AI page uses repository and WeChat adapter only",
            has_js_member_call(page_js, "aiRepository", "generateTitleSuggestions")
            and has_js_member_call(page_js, "wechat", "setClipboardData")
            and has_js_member_call(page_js, "wechat", "showToast"),
            rel(AI_PAGE_JS),
        ),
        Check("Home page keeps AI entry", "onOpenAI" in index_js and "AI 标题生成" in index_wxml, "pages/index"),
    ]


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
    hits: list[str] = []
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
    ai_api_text = read_text(AI_API_PATH)
    mutating_hits = find_occurrences(r"\brequest\.(put|patch|delete)\s*\(|method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']", js_files())
    allowed_post_hits = sorted(post_hits) == ["miniprogram/services/authApi.js"]
    return [
        Check("Legacy request.post hits remain auth-only", allowed_post_hits, "hits=" + (", ".join(post_hits) if post_hits else "none")),
        Check("AI title-suggestions POST stays isolated in aiApi", "/title-suggestions" in ai_api_text and "REQUEST_METHODS.post" in ai_api_text, rel(AI_API_PATH)),
        Check("No PUT/PATCH/DELETE in mini program JS", not mutating_hits, "hits=" + (", ".join(mutating_hits) if mutating_hits else "none")),
    ]


def check_forbidden_diffs() -> list[Check]:
    backend_diff = git_diff_names("backend/alembic", "backend/app/db", "backend/app/models")
    dependency_diff = git_diff_names(
        "package.json",
        "package-lock.json",
        "miniprogram/package.json",
        "pyproject.toml",
        "requirements.txt",
        "requirements-dev.txt",
        "backend/pyproject.toml",
    )
    return [
        Check("No backend migration/db/models diff", not backend_diff, "diff=" + (", ".join(backend_diff) if backend_diff else "none")),
        Check("No dependency diff", not dependency_diff, "diff=" + (", ".join(dependency_diff) if dependency_diff else "none")),
    ]


def check_docs() -> Check:
    if not PHASE6C_DOC.exists():
        return Check("docs/23 present", False, "missing docs/23")
    combined = read_text(PHASE6C_DOC) + "\n" + read_text(README) + "\n" + read_text(HANDOFF)
    required = [
        "Phase 6C",
        "mock-only",
        "DevTools",
        "realApiGateEnabled=false",
        "authRealApiGateEnabled=false",
        "aiRealApiGateEnabled=false",
        "不真实调用 OpenAI",
        "不真实请求后端",
    ]
    missing = [item for item in required if item not in combined]
    return Check("docs and README cover Phase 6C acceptance", not missing, "missing=" + (", ".join(missing) if missing else "none"))


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.extend(check_previous_preflights())
    checks.append(check_json_files())
    checks.extend(check_routes_and_files())
    checks.extend(check_devtools_import_precheck())
    checks.extend(check_env_defaults())
    checks.extend(check_ai_service_contract())
    checks.extend(check_ai_acceptance_behavior())
    checks.extend(check_platform_call_boundaries())
    checks.append(check_openai_and_secret_markers())
    checks.extend(check_write_boundaries())
    checks.extend(check_forbidden_diffs())
    checks.append(check_docs())
    return checks


def main() -> int:
    checks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 6C mini program AI mock acceptance QA")
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
