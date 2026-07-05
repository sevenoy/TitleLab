#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINIPROGRAM = ROOT / "miniprogram"

FORBIDDEN_VISIBLE_TERMS = [
    "AI",
    "智能",
    "问答",
    "绘画",
    "换脸",
    "生成式",
    "深度合成",
    "mock",
    "本地示例",
    "测试版",
    "临时",
    "占位",
    "敬请期待",
    "OpenAI",
    "api.openai.com",
    "OPENAI_API_KEY",
    "API Key",
]

FORBIDDEN_PLATFORM_APIS = [
    "getPhoneNumber",
    "getUserProfile",
    "getUserInfo",
    "getClipboardData",
    "getLocation",
    "chooseAddress",
    "chooseImage",
    "chooseMedia",
]


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def assert_contains(text: str, snippet: str, label: str) -> None:
    if snippet not in text:
        fail(f"{label} missing required text: {snippet}")


def assert_not_contains(text: str, snippet: str, label: str) -> None:
    if snippet in text:
        fail(f"{label} contains forbidden text: {snippet}")


def git_lines(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def main() -> None:
    app_json = json.loads(read_text("miniprogram/app.json"))
    pages = app_json.get("pages", [])
    if not pages or pages[0] != "pages/login/index":
        fail("app.json must keep pages/login/index as the default entry")
    if "pages/categories/index" not in pages:
        fail("app.json must include pages/categories/index")

    for relative_path in [
        "miniprogram/pages/categories/index.js",
        "miniprogram/pages/categories/index.json",
        "miniprogram/pages/categories/index.wxml",
        "miniprogram/pages/categories/index.wxss",
        "miniprogram/pages/login/index.js",
        "miniprogram/pages/settings/index.js",
    ]:
        if not (ROOT / relative_path).is_file():
            fail(f"missing required file: {relative_path}")

    index_js = read_text("miniprogram/pages/index/index.js")
    index_wxml = read_text("miniprogram/pages/index/index.wxml")
    index_wxss = read_text("miniprogram/pages/index/index.wxss")
    categories_wxml = read_text("miniprogram/pages/categories/index.wxml")
    categories_wxss = read_text("miniprogram/pages/categories/index.wxss")
    settings_wxml = read_text("miniprogram/pages/settings/index.wxml")

    assert_contains(index_wxml, "brand-line", "home page")
    assert_contains(index_wxml, "tab-switch", "home page")
    assert_contains(index_wxml, "搜索标题关键词", "home page")
    assert_contains(index_wxml, "搜索文案关键词", "home page")
    assert_contains(index_wxml, "filter-chip", "home page")
    assert_contains(index_wxml, "chip-scroll", "home page")
    assert_contains(index_wxml, "新增标题", "home page")
    assert_contains(index_wxml, "新增文案", "home page")
    assert_contains(index_wxml, "复制", "home page")
    assert_contains(index_wxml, "修改", "home page")
    assert_contains(index_wxml, "删除", "home page")
    assert_contains(index_wxml, "暂无标题", "home empty state")
    assert_contains(index_wxml, "新增一条标题开始整理", "home empty state")
    assert_contains(index_js, 'wechat.navigateTo("/pages/categories/index")', "home categories entry")

    for forbidden in ["上移", "下移", "改名"]:
        assert_not_contains(index_wxml, forbidden, "home page category management")

    assert_contains(categories_wxml, "分类管理", "categories page")
    assert_contains(categories_wxml, "上移", "categories page")
    assert_contains(categories_wxml, "下移", "categories page")
    assert_contains(categories_wxml, "改名", "categories page")

    assert_contains(settings_wxml, "批量导入", "settings page")
    assert_contains(settings_wxml, "主题设置", "settings page")
    assert_contains(settings_wxml, "页面配置", "settings page")
    assert_contains(settings_wxml, "重置本机账号密码", "settings page")

    assert_contains(index_wxss, "box-sizing: border-box", "home WXSS")
    assert_contains(index_wxss, "safe-area-inset-bottom", "home WXSS")
    if "position: fixed" in index_wxss and "safe-area-inset-bottom" not in index_wxss:
        fail("home WXSS uses fixed positioning without safe area handling")

    for label, text in [("home WXSS", index_wxss), ("categories WXSS", categories_wxss)]:
        if re.search(r"(?:width|min-width):\s*[89][0-9]{2}rpx", text):
            fail(f"{label} contains obvious over-wide fixed width")
        if re.search(r"(?:left|right):\s*-", text):
            fail(f"{label} contains negative horizontal positioning")

    visible_surface_files = [
        MINIPROGRAM / "app.json",
        MINIPROGRAM / "project.config.json",
        *[
            path
            for path in (MINIPROGRAM / "pages").rglob("*")
            if path.suffix in {".js", ".json", ".wxml"}
        ],
    ]
    visible_text = "\n".join(path.read_text(encoding="utf-8") for path in visible_surface_files)
    for term in FORBIDDEN_VISIBLE_TERMS:
        if term in visible_text:
            fail(f"user-visible miniprogram files contain forbidden term: {term}")

    miniprogram_source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in MINIPROGRAM.rglob("*")
        if path.suffix in {".js", ".wxml"}
    )
    for api in FORBIDDEN_PLATFORM_APIS:
        if api in miniprogram_source:
            fail(f"forbidden platform API found: {api}")

    for path in (MINIPROGRAM / "pages").rglob("*.js"):
        text = path.read_text(encoding="utf-8")
        if "wx.request" in text:
            fail(f"page directly calls wx.request: {path.relative_to(ROOT)}")
        if "wx.login" in text:
            fail(f"page directly calls wx.login: {path.relative_to(ROOT)}")

    private_config = git_lines("ls-files", "miniprogram/project.private.config.json")
    if private_config:
        fail("miniprogram/project.private.config.json must not be tracked")

    protected_backend = git_lines("diff", "--name-only", "--", "backend/alembic", "backend/app/db", "backend/app/models")
    if protected_backend:
        fail(f"protected backend paths changed: {protected_backend}")

    dependency_files = git_lines("diff", "--name-only", "--", "package.json", "package-lock.json", "miniprogram/package.json", "miniprogram/package-lock.json")
    if dependency_files:
        fail(f"dependency files must not change in Phase 6I: {dependency_files}")

    print("phase6i miniprogram UI check ok")


if __name__ == "__main__":
    main()
