from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Correspondence Series Management System API"
    api_v1_prefix: str = "/api/v1"
    environment: Literal["development", "staging", "production"] = "development"

    secret_key: str = "change-me"
    access_token_expire_minutes: int = 720

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        description="Supabase Postgres async URL",
    )
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800

    storage_backend: Literal["local", "supabase"] = "local"
    local_upload_dir: str = "uploads"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_storage_bucket: str = "correspondence-files"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"

    @property
    def cors_origins_list(self) -> list[str]:
        parsed = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        return parsed or ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
