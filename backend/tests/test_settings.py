import pytest
from pydantic import ValidationError

from core.config import Settings


def test_production_rejects_development_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None, environment="production",
                 jwt_secret="local-development-only-change-before-deploy")

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None, environment="production", jwt_secret="x" * 64)

    secret = "unique-test-secret-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    configured = Settings(_env_file=None, environment="production", jwt_secret=secret)
    assert configured.jwt_secret == secret
