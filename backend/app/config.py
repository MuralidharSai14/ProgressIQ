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
    app_version: str = "1.0.0"

    # Database
    database_url: str = "sqlite:///./progressiq.db"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000


@lru_cache()
def get_settings() -> Settings:
    return Settings()
