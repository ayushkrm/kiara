import re
from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LANGUAGE_CODE_PATTERN = re.compile(
    r"(?:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*|indic-auto)"
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    gnani_api_key: SecretStr | None = None
    gnani_language_code: str = "indic-auto"
    gnani_sample_rate: int = Field(default=16000, ge=8000, le=48000)
    gnani_alert_webhook_url: AnyHttpUrl | None = None
    mock_transcription: bool = True

    @field_validator("gnani_api_key")
    @classmethod
    def validate_api_key(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and not value.get_secret_value().strip():
            raise ValueError("must not be empty")
        return value

    @field_validator("gnani_language_code")
    @classmethod
    def validate_language_code(cls, value: str) -> str:
        if not LANGUAGE_CODE_PATTERN.fullmatch(value):
            raise ValueError("must be a BCP-47 code or 'indic-auto'")
        return value

    @field_validator("gnani_sample_rate")
    @classmethod
    def validate_sample_rate(cls, value: int) -> int:
        if value not in {8000, 16000, 44100, 48000}:
            raise ValueError("must be one of 8000, 16000, 44100, or 48000 Hz")
        return value

    @model_validator(mode="after")
    def require_api_key_for_live_transcription(self) -> Self:
        if not self.mock_transcription and self.gnani_api_key is None:
            raise ValueError("GNANI_API_KEY is required when MOCK_TRANSCRIPTION=false")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
