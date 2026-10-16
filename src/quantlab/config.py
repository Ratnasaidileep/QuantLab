"""QuantLab configuration and environment settings."""

import os
from dataclasses import dataclass, field
from pathlib import Path


def _default_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "*")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@dataclass(frozen=True)
class Settings:
    """Application settings loaded from environment variables with safe defaults."""

    env: str = field(
        default_factory=lambda: os.getenv("QUANTLAB_ENV", "development")
    )
    api_host: str = field(
        default_factory=lambda: os.getenv("API_HOST", "0.0.0.0")
    )
    api_port: int = field(
        default_factory=lambda: int(os.getenv("API_PORT", "8000"))
    )
    data_dir: Path = field(
        default_factory=lambda: Path(os.getenv("QUANTLAB_DATA_DIR", "data"))
    )
    db_path: Path = field(
        default_factory=lambda: Path(os.getenv("QUANTLAB_DB_PATH", "data/quantlab.db"))
    )
    cors_origins: list[str] = field(default_factory=_default_cors_origins)
    jwt_secret: str = field(
        default_factory=lambda: os.getenv(
            "QUANTLAB_JWT_SECRET",
            "quantlab-insecure-dev-secret-key-32bytes-min-auth",
        )
    )
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = field(
        default_factory=lambda: int(os.getenv("QUANTLAB_JWT_EXPIRATION_HOURS", "24"))
    )


settings = Settings()
