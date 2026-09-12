"""
PROGRESSIQ Backend — Application Configuration
Loads environment variables and provides a single settings object.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'),
        env_file_encoding='utf-8',
        extra='ignore',
    )

    # AI Provider
    ai_provider: str = "mock"          # "mock" | "gemini" | "openai"
    gemini_api_key: str = ""
    openai_api_key: str = ""

    # Application
    confidence_threshold: float = 75.0   # Below this → Human Review Queue
    max_upload_size_mb: int = 50
    app_name: str = "PROGRESSIQ"
    app_version: str = "2.0.0"

    # Authentication & Security
    jwt_secret_key: str = "progressiq-super-secret-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Database
    database_url: str = "sqlite:///./progressiq.db"

    # File Storage
    storage_provider: str = "local"     # "local" | "supabase" | "s3"
    storage_local_dir: str = "uploads"
    public_url_base: str = ""           # e.g. "http://localhost:8000" or cloud base URL
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_bucket: str = "evidence-files"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = "progressiq-uploads"

    # Server & CORS
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "*"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
