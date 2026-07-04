from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_NAME = "titlelab-backend"
PROJECT_NAME = "TitleLab"
PHASE = "phase5b-real-ai-provider-gate-readiness"
API_BASE_DOMAIN = "api.title.mirroroo.top"
WEB_DOMAIN = "title.mirroroo.top"
ADMIN_DOMAIN = "admin.title.mirroroo.top"
RELEASE_READY = False


class Settings(BaseSettings):
    database_url: str = ""
    app_env: str = "local"
    api_base_url: str = "https://api.title.mirroroo.top"
    titlelab_session_ttl_seconds: int = 60 * 60 * 24 * 7
    titlelab_ai_provider: str = "mock"
    titlelab_ai_real_provider_enabled: bool = False
    titlelab_ai_model: str = ""
    titlelab_ai_timeout_seconds: int = 15
    titlelab_ai_max_retries: int = 1
    titlelab_ai_daily_budget_cents: int = 0
    titlelab_ai_max_input_chars: int = 2000
    titlelab_ai_max_output_items: int = 5

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
