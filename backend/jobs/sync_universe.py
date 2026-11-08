"""Incrementally fill daily history for the active Vnstock equity universe."""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.postgresql import insert

from db.models import IndexBar, PriceBar, Symbol, UniverseSyncAttempt
from db.session import AsyncSessionLocal
from jobs.ingest_prices import ingest_price_history
from providers.factory import get_configured_market_source_id


def choose_due_symbols(
    rows: list[tuple[str, date | None, date | None]], target: date, batch_size: int,
) -> list[tuple[str, date | None]]:
    """Prefer never fetched symbols, then the oldest stale bars; retry empty symbols on a new index date."""
    due = [(symbol, latest) for symbol, latest, attempted_target in rows
           if (latest is None or latest < target) and attempted_target != target]
    due.sort(key=lambda item: (item[1] is not None, item[1] or date.min, item[0]))
    return due[:batch_size]


def quota_has_headroom(usage: dict, reserve_fraction: float = 0.2) -> bool:
    limits = usage.get("limits") or {}
    used = usage.get("used") or {}
    for period in ("minute", "hour", "day", "month"):
        limit = limits.get(f"per_{period}")
        if not isinstance(limit, (int, float)) or limit <= 0:
            return False
        if used.get(period, 0) >= limit * (1 - reserve_fraction):
            return False
    return True


async def sync_universe_batch(batch_size: int = 50) -> dict[str, int | str | None]:
    if batch_size < 1:
        raise ValueError("batch_size must be positive")
    source = get_configured_market_source_id()
    if source != "vnstock":
        raise RuntimeError("Full-universe sync requires the Vnstock provider")

    import vnstock

    if not quota_has_headroom(vnstock.usage()):
        return {"source": source, "attempted": 0, "remaining": None, "status": "quota_paused"}

    async with AsyncSessionLocal() as session:
        index_as_of = await session.scalar(select(func.max(IndexBar.trade_date)).where(
            IndexBar.source == source, IndexBar.index_symbol == "VNINDEX"
        ))
        target = index_as_of or date.today() - timedelta(days=3)
        rows = (await session.execute(
            select(Symbol.symbol, func.max(PriceBar.trade_date), UniverseSyncAttempt.target_trade_date)
            .outerjoin(PriceBar, and_(PriceBar.symbol == Symbol.symbol, PriceBar.source == source))
            .outerjoin(UniverseSyncAttempt, and_(UniverseSyncAttempt.symbol == Symbol.symbol,
                                                UniverseSyncAttempt.source == source))
            .where(Symbol.is_active.is_(True), Symbol.exchange.in_(("HOSE", "HNX", "UPCOM")))
            .group_by(Symbol.symbol, UniverseSyncAttempt.target_trade_date)
        )).all()

    due = choose_due_symbols(rows, target, batch_size)
    if not due:
        return {"source": source, "target": target.isoformat(), "attempted": 0, "remaining": 0}
    symbols = [symbol for symbol, _ in due]
    earliest = min((latest for _, latest in due if latest is not None), default=None)
    start = (earliest - timedelta(days=7)) if earliest else date.today() - timedelta(days=730)

    # Daily index history is fetched once on a fresh database; the EOD job
    # advances it later. A failed provider batch is retried, not checkpointed.
    result = await ingest_price_history(start=start, end=date.today(), symbols=symbols,
                                        include_indices=index_as_of is None)
    async with AsyncSessionLocal.begin() as session:
        checkpoint_target = (await session.scalar(select(func.max(IndexBar.trade_date)).where(
            IndexBar.source == source, IndexBar.index_symbol == "VNINDEX"
        ))) or target
        statement = insert(UniverseSyncAttempt).values([
            {"source": source, "symbol": symbol, "target_trade_date": checkpoint_target,
             "attempted_at": datetime.now(timezone.utc)} for symbol in symbols
        ])
        await session.execute(statement.on_conflict_do_update(
            index_elements=[UniverseSyncAttempt.source, UniverseSyncAttempt.symbol],
            set_={"target_trade_date": statement.excluded.target_trade_date,
                  "attempted_at": statement.excluded.attempted_at},
        ))
    remaining = len(choose_due_symbols(rows, target, len(rows))) - len(due)
    return {"source": source, "target": checkpoint_target.isoformat(), "attempted": len(due),
            "remaining": remaining, "bars": int(result["bars"]),
            "failed": int(result["failed_symbols"]), "empty": int(result["empty_symbols"])}
