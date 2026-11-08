from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FinSight API"
    environment: str = "development"
    run_snapshot_jobs: bool = True
    market_provider: str = "csv"
    news_feed_enabled: bool = False
    database_url: str = "postgresql+asyncpg://finsight:finsight@localhost:5432/finsight"
    redis_url: str | None = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000"
    openrouter_api_key: str | None = None
    openrouter_model: str = "deepseek/deepseek-chat-v3.1"
    jwt_secret: str = "local-development-only-change-before-deploy"
    vnstock_api_key: str | None = None
    vnstock_symbols: str = "ALL"
    vnstock_request_delay_seconds: float = Field(default=6.0, ge=0)
    provider_rpm: float = Field(default=60.0, gt=0)

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_async_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql+asyncpg://", 1)
        elif value.startswith("postgresql://"):
            value = value.replace("postgresql://", "postgresql+asyncpg://", 1)

        parts = urlsplit(value)
        query = parse_qsl(parts.query, keep_blank_values=True)
        query = [("ssl" if key == "sslmode" else key, val) for key, val in query]
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    @model_validator(mode="after")
    def require_production_jwt_secret(self) -> "Settings":
        if self.environment.lower() == "production" and (
            not self.jwt_secret
            or self.jwt_secret == "local-development-only-change-before-deploy"
            or len(self.jwt_secret.encode("utf-8")) < 32
            or len(set(self.jwt_secret)) < 8
        ):
            raise ValueError("JWT_SECRET must be a strong, non-default value in production")
        return self

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
