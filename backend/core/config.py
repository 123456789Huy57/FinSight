from functools import lru_cache

from pydantic import Field, field_validator
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
    vnstock_symbols: str = "VCB,ACB,MBB,BID,FPT,CMG,SSI,VRE,DXG,PVD,POW,GAS,HPG,SAB,KDC"
    vnstock_request_delay_seconds: float = Field(default=6.0, ge=0)

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_async_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

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
