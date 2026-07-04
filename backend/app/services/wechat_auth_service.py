from __future__ import annotations

from dataclasses import dataclass


class WeChatAuthConfigError(RuntimeError):
    pass


class WeChatAuthProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class WeChatIdentity:
    openid: str
    unionid: str | None = None


class WeChatAuthService:
    def exchange_code_for_wechat_identity(self, code: str) -> WeChatIdentity:
        raise WeChatAuthConfigError("wechat_code_exchange_not_configured")


def get_wechat_auth_service() -> WeChatAuthService:
    return WeChatAuthService()
