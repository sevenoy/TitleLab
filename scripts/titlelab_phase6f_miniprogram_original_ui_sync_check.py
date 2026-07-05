#!/usr/bin/env python3
"""TitleLab Phase 6F mini program original UI inline AI checks.

Static/local only: no backend calls, no external AI calls, no WeChat calls, no
database access, no deployment, and no secret value printing.
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
INDEX_DIR = MINIPROGRAM / "pages" / "index"
INDEX_JS = INDEX_DIR / "index.js"
INDEX_WXML = INDEX_DIR / "index.wxml"
INDEX_WXSS = INDEX_DIR / "index.wxss"
APP_JSON = MINIPROGRAM / "app.json"
PROJECT_CONFIG = MINIPROGRAM / "project.config.json"
ENV_JS = MINIPROGRAM / "config" / "env.js"
REQUEST_JS = MINIPROGRAM / "services" / "request.js"
WECHAT_ADAPTER_JS = MINIPROGRAM / "adapters" / "wechat.js"
README = MINIPROGRAM / "README.md"
PHASE_DOC = ROOT / "docs" / "26_PHASE6F_MINIPROGRAM_ORIGINAL_UI_AI_INLINE_SYNC.md"
HANDOFF = ROOT / "docs" / "08_HANDOFF.md"
ACCEPTANCE = ROOT / "docs" / "07_ACCEPTANCE_CHECKLIST.md"

PRIVATE_PROJECT_CONFIG = "miniprogram/project.private.config.json"
IGNORED_PARTS = {
    "node_modules",
    "dist",
    "build",
    ".next",
    "venv",
    ".venv",
    "logs",
    "coverage",
    "__pycache__",
}
DEPENDENCY_FILES = [
    "pyproject.toml",
    "requirements.txt",
    "requirements-dev.txt",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "backend/pyproject.toml",
    "backend/requirements.txt",
    "backend/requirements-dev.txt",
]
ALLOWED_DIFF_PREFIXES = (
    "miniprogram/",
    "scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py",
    "docs/26_PHASE6F_MINIPROGRAM_ORIGINAL_UI_AI_INLINE_SYNC.md",
    "docs/08_HANDOFF.md",
    "docs/07_ACCEPTANCE_CHECKLIST.md",
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


def combined(paths: list[Path]) -> str:
    return "\n".join(read_text(path) for path in paths)


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
    result = subprocess.run(["git", "diff", "--name-only", "--", *paths], cwd=ROOT, text=True, capture_output=True, check=True)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def git_ls_files(path: str) -> list[str]:
    result = subprocess.run(["git", "ls-files", path], cwd=ROOT, text=True, capture_output=True, check=True)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def contains_all(text: str, needles: list[str]) -> tuple[bool, list[str]]:
    missing = [needle for needle in needles if needle not in text]
    return not missing, missing


def check_files_and_json() -> list[Check]:
    app = json.loads(read_text(APP_JSON))
    project = json.loads(read_text(PROJECT_CONFIG))
    pages = app.get("pages", [])
    settings = project.get("setting", {})
    files = [APP_JSON, PROJECT_CONFIG, INDEX_JS, INDEX_WXML, INDEX_WXSS, README, PHASE_DOC, HANDOFF, ACCEPTANCE]
    return [
        Check("Phase 6F files exist", all(path.exists() for path in files), "missing=" + missing_detail(files)),
        Check("Mini program route contains home", "pages/index/index" in pages, "routes=" + ", ".join(pages)),
        Check("Navigation uses blue white surface", app.get("window", {}).get("navigationBarBackgroundColor") == "#F4F7FB", rel(APP_JSON)),
        Check("project.config projectname current", project.get("projectname") == "TitleLab", rel(PROJECT_CONFIG)),
        Check("project.config compileType is miniprogram", project.get("compileType") == "miniprogram", rel(PROJECT_CONFIG)),
        Check("project.config urlCheck true", settings.get("urlCheck") is True, rel(PROJECT_CONFIG)),
    ]


def missing_detail(paths: list[Path]) -> str:
    missing = [rel(path) for path in paths if not path.exists()]
    return ", ".join(missing) if missing else "none"


def check_ui_contract() -> list[Check]:
    text = combined([INDEX_JS, INDEX_WXML, INDEX_WXSS])
    required = [
        "THE",
        "标题",
        "文案",
        "S",
        "退出",
        "分类管理",
        "搜索标题关键词",
        "搜索文案关键词",
        "账号分类",
        "新增标题",
        "新增文案",
        "批量导入",
        "设为本机默认",
        "主题设置",
        "管理页面",
        "复制",
        "✨AI",
        "修改",
        "删除",
        "activeAiTitleId",
        "expandedCopyId",
        "activeCopyAiId",
        "AI 标题灵感",
        "AI 文案助手",
        "本地示例",
        "相似标题",
        "更吸引人",
        "更小红书",
        "更自然",
        "提取标题",
        "改写文案",
        "生成话题",
        "精简文案",
        "港迪拍照技巧，轻松拍出封面级照片💕",
        "港迪摄影师带你走进魔法，拍出属于你的童话时刻💖",
        "宝妈必看！香港迪士尼亲子照怎么拍才出片💕",
        "半小时也能拍出松弛感港迪旅拍📸",
        "香港本地女摄｜合法持证，安心拍梦幻故事✨",
        "#港迪跟拍 #香港迪士尼拍照 #亲子摄影 #香港女摄影师",
        "全部",
        "亲子",
        "氛围",
        "情侣",
        "闺蜜",
        "单人",
        "街拍",
        "口碑推荐",
        "节日",
        "上移",
        "下移",
        "改",
    ]
    ok, missing = contains_all(text, required)
    return [
        Check("Mini program original UI surface", ok, "missing=" + (", ".join(missing) if missing else "none")),
        Check("THE logo appears before tab copy", read_text(INDEX_WXML).find("THE") < read_text(INDEX_WXML).find("标题"), rel(INDEX_WXML)),
        Check("Category area has no AI entry", "✨AI" not in read_text(INDEX_WXML).split('<view class="toolbar-panel">')[0], rel(INDEX_WXML)),
    ]


def check_forbidden_current_surface() -> list[Check]:
    current_text = combined([INDEX_JS, INDEX_WXML, INDEX_WXSS, APP_JSON, PROJECT_CONFIG])
    forbidden = [
        "顶部绿色 " + "TitleLab",
        "标题" + "与文案素材",
        "先验证列表、筛选、详情" + "和复制闭环",
        "4 条" + "内容卡片",
        "类型/分类/标签" + "三格筛选",
        "高密度" + "数据库",
        "企业级 " + "AI",
        "已" + "发布",
        "草" + "稿",
        "职" + "场",
        "运动" + "穿搭",
        "办公" + "神器",
        "极简" + "主义",
        "2024" + "趋势",
        "咖啡" + "馆",
        "city" + "walk",
        "图片" + "流",
        "灵感" + "库",
        "我的" + "创作",
        "个人" + "中心",
        "api." + "openai" + ".com",
        "OPENAI" + "_API_KEY",
        "API" + " Key",
        "Ga" + "te",
        "To" + "ken",
        "BE" + "TA",
        "Campaign" + " Source",
        "网络" + "异常",
    ]
    hits = [item for item in forbidden if item in current_text]
    return [Check("Affected Phase 6F surface avoids forbidden wording", not hits, "hits=" + (", ".join(hits) if hits else "none"))]


def check_env_and_boundaries() -> list[Check]:
    env_text = read_text(ENV_JS)
    request_hits = find_occurrences(r"\bwx\.request\b", js_files())
    login_hits = find_occurrences(r"\bwx\.login\b", js_files())
    page_request_hits = find_occurrences(r"\bwx\.request\b", page_js_files())
    page_login_hits = find_occurrences(r"\bwx\.login\b", page_js_files())
    private_config = git_ls_files(PRIVATE_PROJECT_CONFIG)
    backend_protected = git_diff_names("backend/alembic", "backend/app/db", "backend/app/models")
    dependency_diff = git_diff_names(*DEPENDENCY_FILES)
    all_diff = git_diff_names()
    out_of_scope = [
        path
        for path in all_diff
        if not any(path == prefix or path.startswith(prefix) for prefix in ALLOWED_DIFF_PREFIXES)
    ]
    return [
        Check("Real request switch default false", "realApi" + "GateEnabled: false" in env_text, rel(ENV_JS)),
        Check("Auth real request switch default false", "authRealApi" + "GateEnabled: false" in env_text, rel(ENV_JS)),
        Check("AI real request switch default false", "aiRealApi" + "GateEnabled: false" in env_text, rel(ENV_JS)),
        Check("wx.request only in services/request.js", sorted(request_hits) == [rel(REQUEST_JS)], "hits=" + (", ".join(request_hits) if request_hits else "none")),
        Check("wx.login only in adapters/wechat.js", sorted(login_hits) == [rel(WECHAT_ADAPTER_JS)], "hits=" + (", ".join(login_hits) if login_hits else "none")),
        Check("Pages do not call wx.request", not page_request_hits, "hits=" + (", ".join(page_request_hits) if page_request_hits else "none")),
        Check("Pages do not call wx.login", not page_login_hits, "hits=" + (", ".join(page_login_hits) if page_login_hits else "none")),
        Check("project.private.config.json not tracked", not private_config, "tracked=" + ("yes" if private_config else "no")),
        Check("No protected backend migration/db/model diff", not backend_protected, "diff=" + (", ".join(backend_protected) if backend_protected else "none")),
        Check("No dependency file diff", not dependency_diff, "diff=" + (", ".join(dependency_diff) if dependency_diff else "none")),
        Check("Diff stays in Phase 6F allowlist", not out_of_scope, "out_of_scope=" + (", ".join(out_of_scope) if out_of_scope else "none")),
    ]


def main() -> int:
    checks: list[Check] = []
    checks.extend(check_files_and_json())
    checks.extend(check_ui_contract())
    checks.extend(check_forbidden_current_surface())
    checks.extend(check_env_and_boundaries())

    failed = [check for check in checks if not check.passed]
    print("TitleLab Phase 6F mini program original UI inline AI check")
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"- {status}: {check.name} ({check.detail})")

    if failed:
        print(f"\nFAILED: {len(failed)} check(s)", file=sys.stderr)
        return 1

    print("\nAll Phase 6F checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
