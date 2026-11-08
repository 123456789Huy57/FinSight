"""Bounded, rate-limited calls to synchronous market-data providers."""

import asyncio
import random
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import Timeout as RequestsTimeout


T = TypeVar("T")
RETRYABLE_ERRORS: tuple[type[Exception], ...] = (
    TimeoutError, ConnectionError, RequestsTimeout, RequestsConnectionError,
)


class TokenBucket:
    """Permit one call at a time, replenished at the configured minute rate."""

    def __init__(
        self,
        requests_per_minute: float,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        if requests_per_minute <= 0:
            raise ValueError("requests_per_minute must be positive")
        self._rate = requests_per_minute / 60.0
        self._clock = clock
        self._sleep = sleep
        self._tokens = 1.0
        self._updated_at = clock()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            while True:
                now = self._clock()
                self._tokens = min(1.0, self._tokens + max(0.0, now - self._updated_at) * self._rate)
                self._updated_at = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                await self._sleep((1.0 - self._tokens) / self._rate)


async def call_with_retry(
    fn: Callable[..., T],
    *args: object,
    attempts: int = 3,
    base_delay: float = 0.5,
    timeout_s: float = 15,
    retry_on: tuple[type[Exception], ...] = RETRYABLE_ERRORS,
    limiter: TokenBucket | None = None,
) -> T:
    """Retry transient provider failures with bounded exponential backoff."""

    if attempts < 1 or base_delay < 0 or timeout_s <= 0:
        raise ValueError("attempts and timeout_s must be positive; base_delay cannot be negative")
    for attempt in range(attempts):
        if limiter is not None:
            await limiter.acquire()
        try:
            return await asyncio.wait_for(asyncio.to_thread(fn, *args), timeout=timeout_s)
        except Exception as exc:
            if attempt == attempts - 1 or not isinstance(exc, retry_on):
                raise
            backoff = base_delay * (2 ** attempt)
            await asyncio.sleep(backoff + random.uniform(0, backoff * 0.2))
    raise AssertionError("retry loop must return or raise")
