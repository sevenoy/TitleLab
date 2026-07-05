#!/usr/bin/env python3
"""TitleLab Phase 6D mini program DevTools/manual acceptance checks.

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
QA_DOCS = DOCS / "qa"
SCRIPTS = ROOT / "scripts"
BACKEND = ROOT / "backend"

APP_JSON = MINIPROGRAM / "app.json"
PROJECT_CONFIG = MINIPROGRAM / "project.config.json"
ENV_PATH = MINIPROGRAM / "config" / "env.js"
REQUEST_PATH = MINIPROGRAM / "services" / "request.js"
WECHAT_ADAPTER_PATH = MINIPROGRAM / "adapters" / "wechat.js"
REAL_GATE_GUARD_PATH = MINIPROGRAM / "services" / "realGateGuard.js"
AI_PAGE_DIR = MINIPROGRAM / "pages" / "ai"
AI_PAGE_JS = AI_PAGE_DIR / "index.js"
AI_PAGE_JSON = AI_PAGE_DIR / "index.json"
AI_PAGE_WXML = AI_PAGE_DIR / "index.wxml"
AI_PAGE_WXSS = AI_PAGE_DIR / "index.wxss"
INDEX_PAGE_JS = MINIPROGRAM / "pages" / "index" / "index.js"
INDEX_PAGE_WXML = MINIPROGRAM / "pages" / "index" / "index.wxml"
AI_MOCK_PATH = MINIPROGRAM / "services" / "aiMock.js"
AI_API_PATH = MINIPROGRAM / "services" / "aiApi.js"
AI_REPOSITORY_PATH = MINIPROGRAM / "services" / "aiRepository.js"
README = MINIPROGRAM / "README.md"
HANDOFF = DOCS / "08_HANDOFF.md"
ACCEPTANCE = DOCS / "07_ACCEPTANCE_CHECKLIST.md"
PHASE6D_DOC = DOCS / "24_PHASE6D_MINIPROGRAM_AI_MOCK_DEVTOOLS_ACCEPTANCE_PACK.md"
MANUAL_CASES = QA_DOCS / "PHASE6D_MINIPROGRAM_AI_MOCK_MANUAL_TEST_CASES.md"
SCREENSHOT_CHECKLIST = QA_DOCS / "PHASE6D_MINIPROGRAM_AI_MOCK_SCREENSHOT_CHECKLIST.md"
BUG_TEMPLATE = QA_DOCS / "PHASE6D_MINIPROGRAM_AI_MOCK_BUG_REPORT_TEMPLATE.md"
BACKEND_AI_API = BACKEND / "app" / "api" / "ai.py"
BACKEND_SCHEMAS = BACKEND / "app" / "schemas.py"
BACKEND_AI_TESTS = BACKEND / "tests" / "test_ai_api.py"

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
ALLOWED_PHASE6D_MINIPROGRAM_DIFF_PREFIXES = {
    "miniprogram/README.md",
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


def git_diff_names(*paths: str) -> list[str]:
    result = subprocess.run(["git", "diff", "--name-only", "--", *paths], cwd=ROOT, check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def git_ls_files(path: str) -> list[str]:
    result = subprocess.run(["git", "ls-files", path], cwd=ROOT, check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def run_script(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(path)], cwd=ROOT, text=True, capture_output=True, check=False)


def is_allowed_phase6d_miniprogram_diff(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in ALLOWED_PHASE6D_MINIPROGRAM_DIFF_PREFIXES)


def only_active_phase6d_miniprogram_doc_diff_failure(output: str) -> bool:
    failed_lines = [line for line in output.splitlines() if line.startswith("- FAIL:")]
    if not failed_lines:
        return False

    allowed_failure_prefixes = (
        "- FAIL: No miniprogram diff ",
        "- FAIL: Phase 5B preflight still passes ",
        "- FAIL: Phase 5C preflight still passes ",
    )
    if any(not line.startswith(allowed_failure_prefixes) for line in failed_lines):
        return False

    diff_names = git_diff_names("miniprogram")
    return bool(diff_names) and all(is_allowed_phase6d_miniprogram_diff(path) for path in diff_names)


def check_previous_preflights() -> list[Check]:
    scripts = [
        ("Phase 4D preflight still passes", SCRIPTS / "titlelab_phase4d_preflight_check.py"),
        ("Phase 4E preflight still passes", SCRIPTS / "titlelab_phase4e_real_gate_check.py"),
        ("Phase 5B preflight still passes", SCRIPTS / "titlelab_phase5b_ai_provider_gate_check.py"),
        ("Phase 5C preflight still passes", SCRIPTS / "titlelab_phase5c_openai_dryrun_contract_check.py"),
        ("Phase 5D preflight still passes", SCRIPTS / "titlelab_phase5d_live_openai_smoke_readiness_check.py"),
        ("Phase 6 preflight still passes", SCRIPTS / "titlelab_phase6_miniprogram_ai_mock_check.py"),
        ("Phase 6B preflight still passes", SCRIPTS / "titlelab_phase6b_miniprogram_ai_mock_ux_check.py"),
        ("Phase 6C preflight still passes", SCRIPTS / "titlelab_phase6c_miniprogram_ai_acceptance_check.py"),
    ]
    checks: list[Check] = []
    for name, path in scripts:
        result = run_script(path)
        if result.returncode == 0:
            checks.append(Check(name, True, "returncode=0"))
            continue

        doc_diff_only = only_active_phase6d_miniprogram_doc_diff_failure(result.stdout)
        detail = "returncode=1; active Phase 6D miniprogram README diff only" if doc_diff_only else f"returncode={result.returncode}"
        checks.append(Check(name, doc_diff_only, detail))
    return checks


def check_json_files() -> Check:
    paths = [
        APP_JSON,
        PROJECT_CONFIG,
        MINIPROGRAM / "sitemap.json",
        MINIPROGRAM / "pages" / "index" / "index.json",
        MINIPROGRAM / "pages" / "detail" / "detail.json",
        AI_PAGE_JSON,
    ]
    failed: list[str] = []
    for path in paths:
        try:
            json.loads(read_text(path))
        except Exception:
            failed.append(rel(path))
    return Check("Mini program JSON files parse", not failed, "failed=" + (", ".join(failed) if failed else "none"))


def check_devtools_import() -> list[Check]:
    project = json.loads(read_text(PROJECT_CONFIG))
    app = json.loads(read_text(APP_JSON))
    settings = project.get("setting", {})
    pages = app.get("pages", [])
    required_pages = ["pages/index/index", "pages/detail/detail", "pages/ai/index"]
    tracked_private = git_ls_files(PRIVATE_PROJECT_CONFIG)
    return [
        Check("DevTools import root is miniprogram", APP_JSON.exists() and PROJECT_CONFIG.exists(), "importRoot=miniprogram/"),
        Check("project.config compileType is miniprogram", project.get("compileType") == "miniprogram", rel(PROJECT_CONFIG)),
        Check("project.config urlCheck stays true", settings.get("urlCheck") is True, rel(PROJECT_CONFIG)),
        Check("Required page routes registered", all(page in pages for page in required_pages), "routes=" + ", ".join(required_pages)),
        Check("project.private.config.json not tracked", not tracked_private, "tracked=" + ("yes" if tracked_private else "no")),
    ]


def check_files_exist() -> list[Check]:
    ai_bundle = [AI_PAGE_JS, AI_PAGE_JSON, AI_PAGE_WXML, AI_PAGE_WXSS]
    service_files = [AI_MOCK_PATH, AI_REPOSITORY_PATH, AI_API_PATH, REQUEST_PATH, REAL_GATE_GUARD_PATH, WECHAT_ADAPTER_PATH]
    backend_files = [BACKEND_AI_API, BACKEND_SCHEMAS, BACKEND_AI_TESTS]
    qa_files = [PHASE6D_DOC, MANUAL_CASES, SCREENSHOT_CHECKLIST, BUG_TEMPLATE]
    return [
        Check("AI page four-file bundle exists", all(path.exists() for path in ai_bundle), "missing=" + missing_detail(ai_bundle)),
        Check("AI mock/repository/api/request/gate/adapter files exist", all(path.exists() for path in service_files), "missing=" + missing_detail(service_files)),
        Check("Backend AI contract files exist", all(path.exists() for path in backend_files), "missing=" + missing_detail(backend_files)),
        Check("Phase 6D QA docs exist", all(path.exists() for path in qa_files), "missing=" + missing_detail(qa_files)),
    ]


def missing_detail(paths: list[Path]) -> str:
    missing = [rel(path) for path in paths if not path.exists()]
    return ", ".join(missing) if missing else "none"


def check_env_defaults() -> list[Check]:
    text = read_text(ENV_PATH)
    required = {
        "apiMode stays mock": "apiMode: API_MODES.MOCK",
        "realApiGateEnabled default false": "realApiGateEnabled: false",
        "authRealApiGateEnabled default false": "authRealApiGateEnabled: false",
        "aiRealApiGateEnabled default false": "aiRealApiGateEnabled: false",
    }
    return [Check(name, needle in text, rel(ENV_PATH)) for name, needle in required.items()]


def check_manual_acceptance_surface() -> list[Check]:
    page_js = read_text(AI_PAGE_JS)
    page_wxml = read_text(AI_PAGE_WXML)
    index_js = read_text(INDEX_PAGE_JS)
    index_wxml = read_text(INDEX_PAGE_WXML)
    mock_text = read_text(AI_MOCK_PATH)
    repo_text = read_text(AI_REPOSITORY_PATH)
    api_text = read_text(AI_API_PATH)
    return [
        Check("Home page has AI entry", "onOpenAI" in index_js and "AI 标题生成" in index_wxml, "pages/index"),
        Check("AI page shows mock-only notice", "Mock-only" in page_wxml and "本地 mock" in page_wxml, rel(AI_PAGE_WXML)),
        Check("AI page supports sourceText count", "sourceLength" in page_js and "{{sourceLength}}/{{sourceLimit}}" in page_wxml, rel(AI_PAGE_JS)),
        Check("AI page supports copy single and copy all", "onCopyTitle" in page_js and "onCopyAll" in page_js and "复制全部" in page_wxml, rel(AI_PAGE_JS)),
        Check("AI page supports clear and retry", "onClear" in page_js and "onRetry" in page_js and "重新生成" in page_wxml, rel(AI_PAGE_JS)),
        Check("AI page covers loading/error/empty/no-result states", all(item in page_wxml for item in ["正在生成 mock 标题", "error", "等待输入内容", "暂无结果"]), rel(AI_PAGE_WXML)),
        Check("AI page covers warning state", "warning-list" in page_wxml and "warnings" in page_js, rel(AI_PAGE_WXML)),
        Check("AI mock can produce no-cost structured suggestions", all(item in mock_text for item in ["estimatedCostCents: 0", "title", "rationale", "tags", "riskLevel", "score"]), rel(AI_MOCK_PATH)),
        Check("aiRepository defaults to mock before real API", "env.isMockMode()" in repo_text and "aiMock.generateTitleSuggestions" in repo_text, rel(AI_REPOSITORY_PATH)),
        Check("aiApi real endpoint remains gated service mapping", "/title-suggestions" in api_text and "REQUEST_METHODS.post" in api_text, rel(AI_API_PATH)),
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


def check_miniprogram_openai_and_secret_markers() -> Check:
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


def check_write_and_diff_boundaries() -> list[Check]:
    put_patch_delete_hits = find_occurrences(r"\brequest\.(put|patch|delete)\s*\(|method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']", js_files())
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
        Check("No PUT/PATCH/DELETE in mini program JS", not put_patch_delete_hits, "hits=" + (", ".join(put_patch_delete_hits) if put_patch_delete_hits else "none")),
        Check("No backend migration/db/models diff", not backend_diff, "diff=" + (", ".join(backend_diff) if backend_diff else "none")),
        Check("No dependency diff", not dependency_diff, "diff=" + (", ".join(dependency_diff) if dependency_diff else "none")),
    ]


def check_qa_docs_content() -> list[Check]:
    phase6d = read_text(PHASE6D_DOC)
    manual = read_text(MANUAL_CASES)
    screenshots = read_text(SCREENSHOT_CHECKLIST)
    bug = read_text(BUG_TEMPLATE)
    readme = read_text(README)
    handoff = read_text(HANDOFF)
    acceptance = read_text(ACCEPTANCE)
    phase6d_required = [
        "DevTools 导入",
        "AppID",
        "不上传体验版",
        "不提交审核",
        "mock-only",
        "首页入口",
        "复制",
        "清空",
        "重试",
        "截图清单",
        "问题记录模板",
        "禁止项",
        "测试命令",
    ]
    manual_required = [
        "打开首页",
        "从首页进入 AI 标题生成",
        "空输入生成",
        "短输入生成",
        "正常输入生成",
        "示例输入填充",
        "tone/platform/contentType/count",
        "复制单条",
        "复制全部",
        "清空",
        "重试",
        "过长输入",
        "疑似敏感输入",
        "mock-only",
        "返回首页",
        "不登录状态",
        "网络关闭状态",
    ]
    screenshot_required = ["首页入口截图", "AI 页面初始态", "示例输入态", "loading 态", "结果列表态", "warning 态", "空输入错误态", "复制成功 toast", "清空后状态", "重试后状态"]
    bug_required = ["设备/模拟器", "微信开发者工具版本", "基础库版本", "复现步骤", "预期结果", "实际结果", "截图路径", "控制台错误", "是否阻塞", "建议优先级"]
    combined = readme + "\n" + handoff + "\n" + acceptance
    return [
        Check("docs/24 covers DevTools/manual acceptance scope", all(item in phase6d for item in phase6d_required), "missing=" + missing_items(phase6d, phase6d_required)),
        Check("Manual test cases cover required scenarios", all(item in manual for item in manual_required), "missing=" + missing_items(manual, manual_required)),
        Check("Screenshot checklist covers required captures", all(item in screenshots for item in screenshot_required), "missing=" + missing_items(screenshots, screenshot_required)),
        Check("Bug report template covers required fields", all(item in bug for item in bug_required), "missing=" + missing_items(bug, bug_required)),
        Check("README/HANDOFF/acceptance mention Phase 6D", all(item in combined for item in ["Phase 6D", "DevTools/manual acceptance", "titlelab_phase6d_miniprogram_devtools_acceptance_check.py"]), "docs updated"),
    ]


def missing_items(text: str, items: list[str]) -> str:
    missing = [item for item in items if item not in text]
    return ", ".join(missing) if missing else "none"


def check_backend_ai_contract() -> list[Check]:
    api_text = read_text(BACKEND_AI_API)
    schemas_text = read_text(BACKEND_SCHEMAS)
    tests_text = read_text(BACKEND_AI_TESTS)
    return [
        Check("Backend AI facade endpoint remains title-suggestions", '@router.post("/title-suggestions"' in api_text, rel(BACKEND_AI_API)),
        Check("Backend AI schema includes suggestions envelope", all(item in schemas_text for item in ["AITitleSuggestionRequest", "AITitleSuggestionOut", "AITitleSuggestionsResponse"]), rel(BACKEND_SCHEMAS)),
        Check("Backend AI tests cover mock and disabled real provider", all(item in tests_text for item in ["mock", "real_provider_disabled", "missing_key"]), rel(BACKEND_AI_TESTS)),
    ]


def run_checks() -> list[Check]:
    checks: list[Check] = []
    checks.extend(check_previous_preflights())
    checks.append(check_json_files())
    checks.extend(check_devtools_import())
    checks.extend(check_files_exist())
    checks.extend(check_env_defaults())
    checks.extend(check_manual_acceptance_surface())
    checks.extend(check_platform_call_boundaries())
    checks.append(check_miniprogram_openai_and_secret_markers())
    checks.extend(check_write_and_diff_boundaries())
    checks.extend(check_qa_docs_content())
    checks.extend(check_backend_ai_contract())
    return checks


def main() -> int:
    checks = run_checks()
    failed = [check for check in checks if not check.passed]

    print("TitleLab Phase 6D mini program AI mock DevTools/manual acceptance pack")
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
    print("Preview upload or review submission: none")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
