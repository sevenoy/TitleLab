#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINIPROGRAM = ROOT / "miniprogram"

REQUIRED_ROUTES = [
    "pages/login/index",
    "pages/index/index",
    "pages/settings/index",
    "pages/legal/privacy",
    "pages/legal/terms",
]

REQUIRED_FILES = [
    "miniprogram/pages/login/index.js",
    "miniprogram/pages/login/index.json",
    "miniprogram/pages/login/index.wxml",
    "miniprogram/pages/login/index.wxss",
    "miniprogram/pages/settings/index.js",
    "miniprogram/pages/settings/index.json",
    "miniprogram/pages/settings/index.wxml",
    "miniprogram/pages/settings/index.wxss",
    "miniprogram/pages/legal/privacy.js",
    "miniprogram/pages/legal/privacy.json",
    "miniprogram/pages/legal/privacy.wxml",
    "miniprogram/pages/legal/privacy.wxss",
    "miniprogram/pages/legal/terms.js",
    "miniprogram/pages/legal/terms.json",
    "miniprogram/pages/legal/terms.wxml",
    "miniprogram/pages/legal/terms.wxss",
]

FORBIDDEN_VISIBLE_TERMS = [
    "AI",
    "\u2728AI",
    "\u667a\u80fd",
    "\u751f\u6210",
    "\u751f\u6210\u5f0f",
    "\u6df1\u5ea6\u5408\u6210",
    "mock",
    "\u672c\u5730\u793a\u4f8b",
    "\u6d4b\u8bd5\u7248",
    "\u4e34\u65f6",
    "\u5360\u4f4d",
    "\u656c\u8bf7\u671f\u5f85",
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

REQUIRED_PRIVACY_SNIPPETS = [
    "\u4fe1\u606f\u5904\u7406",
    "\u4fe1\u606f\u7c7b\u578b",
    "\u6388\u6743\u4e0e\u540c\u610f",
    "\u5fae\u4fe1\u5934\u50cf",
    "\u624b\u673a\u53f7",
    "\u901a\u8baf\u5f55",
    "\u4f4d\u7f6e",
    "\u76f8\u518c",
    "\u76f8\u673a",
    "\u9ea6\u514b\u98ce",
    "\u526a\u8d34\u677f",
    "\u8d26\u53f7\u6ce8\u9500",
    "\u6570\u636e\u5220\u9664",
    "\u5bf9\u5916\u63d0\u4f9b",
    "example@example.com",
]

REQUIRED_TERMS_SNIPPETS = [
    "\u7528\u6237\u8d23\u4efb",
    "\u7981\u6b62\u884c\u4e3a",
    "\u6536\u96c6\u3001\u51fa\u552e\u3001\u8f6c\u8ba9\u3001\u6cc4\u9732",
    "\u6765\u6e90\u5408\u6cd5",
    "\u5fc5\u8981\u6388\u6743",
    "\u505c\u7528",
    "\u6ce8\u9500",
    "example@example.com",
]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def assert_json(relative_path: str) -> dict:
    try:
      return json.loads(read_text(relative_path))
    except Exception as error:
      fail(f"{relative_path} is not valid JSON: {error}")


def assert_contains(text: str, snippet: str, label: str) -> None:
    if snippet not in text:
        fail(f"{label} missing required text: {snippet}")


def main() -> None:
    app_json = assert_json("miniprogram/app.json")
    pages = app_json.get("pages", [])
    if not pages or pages[0] != "pages/login/index":
        fail("app.json must keep pages/login/index as the default entry")
    missing_routes = [route for route in REQUIRED_ROUTES if route not in pages]
    if missing_routes:
        fail(f"app.json missing required Phase 6G routes: {missing_routes}")

    if "pages/ai/index" in pages:
        fail("pages/ai/index must not be routed in Phase 6G")

    if (MINIPROGRAM / "pages" / "ai").exists():
        fail("miniprogram/pages/ai must be removed for Phase 6G")

    for relative_path in [
        "miniprogram/services/aiApi.js",
        "miniprogram/services/aiMock.js",
        "miniprogram/services/aiRepository.js",
        "miniprogram/services/aiResultNormalizer.js",
    ]:
        if (ROOT / relative_path).exists():
            fail(f"unused historical service must be removed: {relative_path}")

    for relative_path in REQUIRED_FILES:
        if not (ROOT / relative_path).is_file():
            fail(f"missing required file: {relative_path}")

    for relative_path in REQUIRED_FILES:
        if relative_path.endswith(".json"):
            assert_json(relative_path)

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
            fail(f"user-visible Phase 6G files still contain forbidden term: {term}")

    login_js = read_text("miniprogram/pages/login/index.js")
    login_wxml = read_text("miniprogram/pages/login/index.wxml")
    assert_contains(login_wxml, "TitleLab", "login page")
    assert_contains(login_wxml, "\u672c\u4ea7\u54c1\u8d26\u53f7\u767b\u5f55", "login page")
    assert_contains(login_wxml, "\u4e0d\u4f1a\u8981\u6c42\u4f60\u586b\u5199\u5fae\u4fe1\u8d26\u53f7\u3001\u5fae\u4fe1\u5bc6\u7801\u6216\u5fae\u4fe1\u9a8c\u8bc1\u7801", "login page")
    assert_contains(login_wxml, "\u300a\u7528\u6237\u670d\u52a1\u534f\u8bae\u300b", "login page")
    assert_contains(login_wxml, "\u300a\u9690\u79c1\u653f\u7b56\u300b", "login page")
    assert_contains(login_js, "localAuth.login", "login page")
    assert_contains(login_js, "\u8bf7\u5148\u9605\u8bfb\u5e76\u52fe\u9009\u300a\u7528\u6237\u670d\u52a1\u534f\u8bae\u300b\u300a\u9690\u79c1\u653f\u7b56\u300b\u540e\u518d\u7ee7\u7eed\u3002", "login page")

    privacy = read_text("miniprogram/pages/legal/privacy.wxml")
    for snippet in REQUIRED_PRIVACY_SNIPPETS:
        assert_contains(privacy, snippet, "privacy page")

    terms = read_text("miniprogram/pages/legal/terms.wxml")
    for snippet in REQUIRED_TERMS_SNIPPETS:
        assert_contains(terms, snippet, "terms page")

    settings = read_text("miniprogram/pages/settings/index.wxml")
    assert_contains(settings, "\u8d26\u53f7\u6ce8\u9500\u4e0e\u6570\u636e\u5220\u9664", "settings page")
    assert_contains(settings, "\u9000\u51fa\u767b\u5f55", "settings page")

    miniprogram_source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in MINIPROGRAM.rglob("*")
        if path.suffix in {".js", ".wxml"}
    )
    for api in FORBIDDEN_PLATFORM_APIS:
        if api in miniprogram_source:
            fail(f"forbidden platform API found: {api}")

    page_files = [path for path in (MINIPROGRAM / "pages").rglob("*.js")]
    for path in page_files:
        text = path.read_text(encoding="utf-8")
        if "wx.request" in text:
            fail(f"page directly calls wx.request: {path.relative_to(ROOT)}")
        if "wx.login" in text:
            fail(f"page directly calls wx.login: {path.relative_to(ROOT)}")

    set_clipboard_locations = [
        str(path.relative_to(ROOT))
        for path in MINIPROGRAM.rglob("*.js")
        if "setClipboardData" in path.read_text(encoding="utf-8")
    ]
    allowed_clipboard = {
        "miniprogram/adapters/wechat.js",
        "miniprogram/pages/index/index.js",
        "miniprogram/pages/detail/detail.js",
        "miniprogram/pages/ai/index.js",
    }
    unexpected_clipboard = sorted(set(set_clipboard_locations) - allowed_clipboard)
    if unexpected_clipboard:
        fail(f"unexpected setClipboardData locations: {unexpected_clipboard}")

    appid_config = assert_json("miniprogram/project.config.json")
    if appid_config.get("appid") != "wx2f9db77f2383b42e":
        fail("project.config.json appid mismatch")
    if appid_config.get("compileType") != "miniprogram":
        fail("project.config.json compileType mismatch")
    if appid_config.get("setting", {}).get("urlCheck") is not True:
        fail("project.config.json urlCheck must be true")

    print("phase6g miniprogram compliance check ok")


if __name__ == "__main__":
    main()
