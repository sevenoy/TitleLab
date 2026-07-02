from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_NAME = "titlelab-backend"
PROJECT_NAME = "TitleLab"
PHASE = "phase1-backend-foundation"
API_BASE_DOMAIN = "api.title.mirroroo.top"
WEB_DOMAIN = "title.mirroroo.top"
ADMIN_DOMAIN = "admin.title.mirroroo.top"
RELEASE_READY = False


class Settings(BaseSettings):
    database_url: str = ""
    app_env: str = "local"
    api_base_url: str = "https://api.title.mirroroo.top"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
