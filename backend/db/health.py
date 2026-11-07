from sqlalchemy import text

from core.config import settings
from db.session import engine


async def readiness() -> dict[str, str]:
    checks = {"database": "ok", "redis": "disabled"}
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:
        checks["database"] = "error"

    if settings.redis_url:
        try:
            from redis.asyncio import Redis

            client = Redis.from_url(settings.redis_url, socket_connect_timeout=1)
            await client.ping()
            await client.aclose()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "error"

    checks["status"] = "ok" if all(v in {"ok", "disabled"} for k, v in checks.items() if k != "status") else "error"
    return checks
