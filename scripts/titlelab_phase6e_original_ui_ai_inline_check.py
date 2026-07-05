#!/usr/bin/env python3
"""TitleLab Phase 6E original UI inline AI checks.

Static/local only: no backend calls, no OpenAI calls, no database access, no
dependency installation, and no secret value printing.
"""

from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

UI_FILES = [
    ROOT / "index.html",
    ROOT / "title.html",
    ROOT / "content.html",
    ROOT / "assets" / "app-title.js",
    ROOT / "assets" / "app-content.js",
    ROOT / "assets" / "styles.css",
]

TITLE_UI_FILES = [
    ROOT / "index.html",
    ROOT / "title.html",
    ROOT / "assets" / "app-title.js",
]

CONTENT_UI_FILES = [
    ROOT / "content.html",
    ROOT / "assets" / "app-content.js",
]

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

FORBIDDEN_UI_PATTERNS = [
    r"api\." + r"openai" + r"\.com",
    "OPENAI" + "_API_KEY",
    "API" + r"\s*" + "Key",
    "API" + r"\s*" + "接口",
    "ai" + "Api",
    "Authorization" + r":\s*" + "Bearer",
    "Campaign" + " Source",
    r"\b" + "BE" + "TA" + r"\b",
    r"\b" + "Gate" + r"\b",
    r"\b" + "Token" + r"\b",
    "网络" + "异常",
    "已" + "发布",
    "草" + "稿",
    "职" + "场",
    "运动" + "穿搭",
    "办公" + "神器",
    "极简" + "主义",
    "2024" + r"\s*" + "趋势",
    "city" + "walk",
    "咖啡" + "馆",
    r"cdn\.tailwindcss",
    r"fonts\.googleapis",
    "Material" + " Symbols",
    r"lh3\.googleusercontent",
    r"https?://[^\"')\s]+(?:png|jpe?g|webp|gif|svg)",
]


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


def git_diff_names(*paths: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--", *paths],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def git_ls_files(path: str) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", path],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def node_check(path: Path) -> Check:
    result = subprocess.run(
        ["node", "--check", rel(path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return Check(f"node --check {rel(path)}", result.returncode == 0, f"returncode={result.returncode}")


def contains_all(text: str, needles: list[str]) -> tuple[bool, list[str]]:
    missing = [needle for needle in needles if needle not in text]
    return not missing, missing


def check_real_ui_identity() -> list[Check]:
    text = combined(UI_FILES)
    required = [
        "THE",
        "标题",
        "文案",
        "账号分类",
        "管理页面",
        "设为本机默认",
        "主题设置",
        "复制",
        "✨AI",
        "修改",
        "删除",
    ]
    ok, missing = contains_all(text, required)
    return [
        Check("Real UI files exist", all(path.exists() for path in UI_FILES), ", ".join(rel(path) for path in UI_FILES)),
        Check("Original UI identity remains", ok, "missing=" + (", ".join(missing) if missing else "none")),
    ]


def check_inline_ai_contract() -> list[Check]:
    title_text = combined(TITLE_UI_FILES)
    content_text = combined(CONTENT_UI_FILES)
    checks = []
    title_required = [
        "activeAiTitleId",
        "AI 标题灵感",
        "本地示例",
        "相似标题",
        "更吸引人",
        "更小红书",
        "更自然",
        "港迪拍照技巧，轻松拍出封面级照片💕",
        "在香港迪士尼，把亲子照拍成童话感✨",
        "半小时也能拍出松弛感港迪旅拍📸",
        "加入标题库",
    ]
    ok, missing = contains_all(title_text, title_required)
    checks.append(Check("Title inline AI panel contract", ok, "missing=" + (", ".join(missing) if missing else "none")))

    content_required = [
        "expandedCopyId",
        "activeCopyAiId",
        "AI 文案助手",
        "提取标题",
        "改写文案",
        "生成话题",
        "精简文案",
        "香港本地女摄｜合法持证，安心拍梦幻故事✨",
        "#港迪跟拍 #香港迪士尼拍照 #亲子摄影 #香港女摄影师",
    ]
    ok, missing = contains_all(content_text, content_required)
    checks.append(Check("Copy inline AI and expand contract", ok, "missing=" + (", ".join(missing) if missing else "none")))
    return checks


def check_forbidden_ui_patterns() -> list[Check]:
    hits: list[str] = []
    for path in UI_FILES:
      text = read_text(path)
      for pattern in FORBIDDEN_UI_PATTERNS:
          if re.search(pattern, text, flags=re.IGNORECASE):
              hits.append(f"{rel(path)}::{pattern}")
    return [Check("Affected UI files avoid forbidden copy and external assets", not hits, "hits=" + (", ".join(hits) if hits else "none"))]


def check_stitch_drift() -> list[Check]:
    text = combined(UI_FILES)
    interactive_text = combined([
        ROOT / "index.html",
        ROOT / "title.html",
        ROOT / "content.html",
        ROOT / "assets" / "app-title.js",
        ROOT / "assets" / "app-content.js",
    ])
    forbidden = ["灵感" + "库", "我的" + "创作", "个人" + "中心", "内容" + "工作台", "图片" + "流"]
    hits = [item for item in forbidden if item in text]
    floating_plus = bool(re.search(r"floating[-_]?(?:plus|button)|\bfab\b|right-bottom-plus", interactive_text, flags=re.IGNORECASE))
    return [
        Check("No Stitch bottom-tab/new-app wording", not hits, "hits=" + (", ".join(hits) if hits else "none")),
        Check("No obvious floating plus structure", not floating_plus, "floating_plus=" + str(floating_plus).lower()),
    ]


def check_frontend_static() -> list[Check]:
    return [
        node_check(ROOT / "assets" / "app-title.js"),
        node_check(ROOT / "assets" / "app-content.js"),
    ]


def check_diff_boundaries() -> list[Check]:
    backend_protected = git_diff_names("backend/alembic", "backend/app/db", "backend/app/models")
    dependency_diff = git_diff_names(*DEPENDENCY_FILES)
    private_config = git_ls_files("miniprogram/project.private.config.json")
    return [
        Check("No protected backend migration/db/model diff", not backend_protected, "diff=" + (", ".join(backend_protected) if backend_protected else "none")),
        Check("No dependency file diff", not dependency_diff, "diff=" + (", ".join(dependency_diff) if dependency_diff else "none")),
        Check("project.private.config.json not tracked", not private_config, "tracked=" + ("yes" if private_config else "no")),
    ]


def main() -> int:
    checks: list[Check] = []
    checks.extend(check_real_ui_identity())
    checks.extend(check_inline_ai_contract())
    checks.extend(check_forbidden_ui_patterns())
    checks.extend(check_stitch_drift())
    checks.extend(check_frontend_static())
    checks.extend(check_diff_boundaries())

    failed = [check for check in checks if not check.passed]
    print("TitleLab Phase 6E original UI inline AI check")
    for check in checks:
        status = "PASS" if check.passed else "FAIL"
        print(f"- {status}: {check.name} ({check.detail})")

    if failed:
        print(f"\nFAILED: {len(failed)} check(s)", file=sys.stderr)
        return 1

    print("\nOK: Phase 6E original UI inline AI checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
