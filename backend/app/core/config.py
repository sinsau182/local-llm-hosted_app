from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ai-inference-platform-api"
    app_env: str = "dev"
    api_prefix: str = "/backend/v1"

    llama_url: str = "http://localhost:4000"
    llama_timeout_seconds: float = 30.0
    litellm_api_key: str = "sk-f4fe27901e83c3ebf669625d9b291d27dc4908b2a671bb91f3bdda42e905d2b3"

    chromadb_host: str = "localhost"
    chromadb_port: int = 8010
    chromadb_path: str = ".chromadb"
    chromadb_collection: str = "documents"

    jwt_private_key: str = "c77c5664716d90f82b5df8c54625e23e7c44cd5d1fe4b367bc07ac9651647dc1"
    jwt_public_key: str = "unused"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    database_url: str = "postgresql+psycopg://platform_user:platform_password@localhost:5432/platform"
    redis_url: str = "redis://localhost:6379/0"

    media_root: str = "/data/media"
    max_storage_bytes: int = 322122547200
    max_request_timeout_seconds: int = 600

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
