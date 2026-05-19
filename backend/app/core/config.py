from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ai-inference-platform-api"
    app_env: str = "dev"
    api_prefix: str = "/api/v1"

    jwt_private_key: str = "replace_with_private_key"
    jwt_public_key: str = "replace_with_public_key"
    jwt_algorithm: str = "RS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    database_url: str = "postgresql+psycopg://platform_user:platform_password@localhost:5432/platform"
    redis_url: str = "redis://localhost:6379/0"

    media_root: str = "/data/media"
    max_storage_bytes: int = 322122547200
    max_request_timeout_seconds: int = 600

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
