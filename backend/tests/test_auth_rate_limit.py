import asyncio

import pytest
from fastapi import HTTPException, Request

from api.v1 import auth
from core.config import settings


def _proxy_request() -> Request:
    return Request({"type": "http", "client": ("next-proxy", 50000),
                    "method": "POST", "path": "/api/v1/auth/login", "headers": []})


def test_many_accounts_behind_one_proxy_do_not_share_small_login_limit(monkeypatch):
    monkeypatch.setattr(settings, "redis_url", None)
    auth._attempts.clear()
    request = _proxy_request()

    for index in range(12):
        asyncio.run(auth._rate_limit(request, "login", f"user{index}@example.test"))
    for _ in range(8):
        asyncio.run(auth._rate_limit(request, "login", "target@example.test"))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth._rate_limit(request, "login", "target@example.test"))
    assert exc.value.status_code == 429
    auth._attempts.clear()


def test_production_auth_fails_closed_when_redis_is_unavailable(monkeypatch):
    from redis.asyncio import Redis

    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "redis_url", "redis://unavailable/0")
    monkeypatch.setattr(Redis, "from_url", lambda *args, **kwargs: (_ for _ in ()).throw(OSError("offline")))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth._rate_limit(_proxy_request(), "login", "target@example.test"))
    assert exc.value.status_code == 503
