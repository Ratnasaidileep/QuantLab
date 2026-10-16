import os
from pathlib import Path
from unittest import mock

from quantlab.config import Settings


def test_default_settings():
    settings = Settings()
    assert settings.env == "development"
    assert settings.api_host == "0.0.0.0"
    assert settings.api_port == 8000
    assert settings.data_dir == Path("data")
    assert settings.db_path == Path("data/quantlab.db")
    assert settings.cors_origins == ["*"]


def test_custom_environment_settings():
    env_vars = {
        "QUANTLAB_ENV": "production",
        "API_HOST": "127.0.0.1",
        "API_PORT": "9000",
        "QUANTLAB_DATA_DIR": "/custom/data",
        "QUANTLAB_DB_PATH": "/custom/db.sqlite",
        "CORS_ORIGINS": "https://example.com, https://quantlab.internal",
    }
    with mock.patch.dict(os.environ, env_vars, clear=True):
        settings = Settings(
            env=os.getenv("QUANTLAB_ENV", "development"),
            api_host=os.getenv("API_HOST", "0.0.0.0"),
            api_port=int(os.getenv("API_PORT", "8000")),
            data_dir=Path(os.getenv("QUANTLAB_DATA_DIR", "data")),
            db_path=Path(os.getenv("QUANTLAB_DB_PATH", "data/quantlab.db")),
            cors_origins=[
                s.strip()
                for s in os.getenv("CORS_ORIGINS", "*").split(",")
                if s.strip()
            ],
        )
        assert settings.env == "production"
        assert settings.api_host == "127.0.0.1"
        assert settings.api_port == 9000
        assert settings.data_dir == Path("/custom/data")
        assert settings.db_path == Path("/custom/db.sqlite")
        assert settings.cors_origins == [
            "https://example.com",
            "https://quantlab.internal",
        ]
