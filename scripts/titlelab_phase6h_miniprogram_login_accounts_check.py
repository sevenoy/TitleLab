#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MINIPROGRAM = ROOT / "miniprogram"

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

    login_js = read_text("miniprogram/pages/login/index.js")
    login_wxml = read_text("miniprogram/pages/login/index.wxml")
    local_auth = read_text("miniprogram/services/localAuth.js")
    settings_js = read_text("miniprogram/pages/settings/index.js")
    settings_wxml = read_text("miniprogram/pages/settings/index.wxml")

    assert_contains(login_wxml, "本产品账号登录", "login page")
    assert_contains(
        login_wxml,
        "本页面仅用于本产品账号登录，不会要求你填写微信账号、微信密码或微信验证码。",
        "login page",
    )
    assert_contains(login_wxml, "产品账号", "login page")
    assert_contains(login_wxml, "产品密码", "login page")
    assert_not_contains(login_wxml, '<text class="field-label">微信账号</text>', "login label")
    assert_not_contains(login_wxml, '<text class="field-label">微信密码</text>', "login label")
    assert_not_contains(login_wxml, "test/test", "login page")
    assert_not_contains(login_wxml, "test / test", "login page")

    assert_contains(login_js, "localAuth.login", "login page")
    assert_contains(
        login_js,
        "请先阅读并勾选《用户服务协议》《隐私政策》后再继续。",
        "login page",
    )
    assert_not_contains(login_js, "audit_test", "login page")

    assert_contains(local_auth, 'OWNER_USERNAME = "olina"', "localAuth")
    assert_contains(local_auth, 'AUDIT_USERNAME = "test"', "localAuth")
    assert_contains(local_auth, 'AUDIT_PASSWORD = "test"', "localAuth")
    assert_contains(local_auth, 'OWNER_PASSWORD_KEY = "titlelab.local.owner.password"', "localAuth")
    assert_contains(local_auth, 'SESSION_KEY = "titlelab.local.login.session"', "localAuth")
    assert_contains(local_auth, "请输入产品密码。", "localAuth")
    assert_contains(local_auth, "账号或密码不正确。", "localAuth")
    assert_contains(local_auth, "createdPassword: true", "localAuth")
    assert_not_contains(local_auth, "olina_password", "localAuth")
    assert_not_contains(local_auth, "olinaPassword", "localAuth")
    assert_not_contains(local_auth, "OLINA_PASSWORD", "localAuth")
    assert_not_contains(local_auth, "Token", "localAuth")
    assert_not_contains(local_auth, "Gate", "localAuth")

    assert_contains(settings_wxml, "重置本机账号密码", "settings page")
    assert_contains(
        settings_js,
        "确认清除本机保存的 olina 密码？清除后可在下次登录时重新设置。",
        "settings page",
    )
    assert_contains(settings_js, "localAuth.resetOwnerPassword", "settings page")
    assert_contains(settings_js, "localAuth.clearLocalSession", "settings page")

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

    page_files = [path for path in (MINIPROGRAM / "pages").rglob("*.js")]
    for path in page_files:
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
        fail(f"dependency files must not change in Phase 6H: {dependency_files}")

    print("phase6h miniprogram login accounts check ok")


if __name__ == "__main__":
    main()
