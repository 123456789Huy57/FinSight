import asyncio
import sys
import time
from types import ModuleType, SimpleNamespace

import pytest

from providers.resilience import TokenBucket, call_with_retry
from jobs.ingest_prices import _is_provider_limit_error


def test_retries_two_transient_failures_before_success() -> None:
    calls = 0

    def flaky() -> str:
        nonlocal calls
        calls += 1
        if calls < 3:
            raise ConnectionError("temporary")
        return "ready"

    assert asyncio.run(call_with_retry(flaky, base_delay=0)) == "ready"
    assert calls == 3


def test_exhausted_retries_raise_last_error() -> None:
    calls = 0

    def unavailable() -> None:
        nonlocal calls
        calls += 1
        raise ConnectionError("still unavailable")

    with pytest.raises(ConnectionError, match="still unavailable"):
        asyncio.run(call_with_retry(unavailable, base_delay=0))
    assert calls == 3


def test_non_transient_error_is_not_retried() -> None:
    calls = 0

    def invalid() -> None:
        nonlocal calls
        calls += 1
        raise ValueError("bad response")

    with pytest.raises(ValueError, match="bad response"):
        asyncio.run(call_with_retry(invalid, base_delay=0))
    assert calls == 1


def test_provider_call_times_out() -> None:
    def slow() -> None:
        time.sleep(0.05)

    with pytest.raises(TimeoutError):
        asyncio.run(call_with_retry(slow, attempts=1, timeout_s=0.005))


def test_token_bucket_spaces_calls_with_fake_clock() -> None:
    now = 100.0
    waits: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        nonlocal now
        waits.append(seconds)
        now += seconds

    limiter = TokenBucket(12, clock=lambda: now, sleep=fake_sleep)

    async def use_three_tokens() -> None:
        for _ in range(3):
            await limiter.acquire()

    asyncio.run(use_three_tokens())
    assert waits == pytest.approx([5.0, 5.0])


def test_retries_also_consume_rate_limit_tokens() -> None:
    now = 0.0
    waits: list[float] = []
    calls = 0

    async def fake_sleep(seconds: float) -> None:
        nonlocal now
        waits.append(seconds)
        now += seconds

    def flaky() -> int:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise ConnectionError("temporary")
        return calls

    limiter = TokenBucket(60, clock=lambda: now, sleep=fake_sleep)
    assert asyncio.run(call_with_retry(flaky, base_delay=0, limiter=limiter)) == 2
    assert waits == pytest.approx([1.0])


def test_vnstock_entitlement_and_rate_limits_stop_ingestion(monkeypatch) -> None:
    class EntitlementError(Exception):
        pass

    class RateLimitedError(Exception):
        pass

    class HttpQuotaError(Exception):
        status = 429

    fake_vnstock = ModuleType("vnstock")
    fake_core = ModuleType("vnstock.core")
    fake_errors = ModuleType("vnstock.core.exceptions")
    fake_errors.EntitlementError = EntitlementError  # type: ignore[attr-defined]
    fake_errors.RateLimitedError = RateLimitedError  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "vnstock", fake_vnstock)
    monkeypatch.setitem(sys.modules, "vnstock.core", fake_core)
    monkeypatch.setitem(sys.modules, "vnstock.core.exceptions", fake_errors)
    provider = SimpleNamespace(source_id="vnstock")

    assert _is_provider_limit_error(EntitlementError(), provider)
    assert _is_provider_limit_error(RateLimitedError(), provider)
    assert _is_provider_limit_error(HttpQuotaError(), provider)
    assert not _is_provider_limit_error(ConnectionError(), provider)
