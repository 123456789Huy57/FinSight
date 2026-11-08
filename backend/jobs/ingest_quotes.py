"""Persist a full equity quote board in one provider request."""

import math
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

import pandas as pd
from sqlalchemy import delete, select

from db.models import MarketSnapshot, Symbol
from db.session import AsyncSessionLocal
from providers.factory import get_market_provider
from providers.resilience import call_with_retry


VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def quote_refresh_due(now: datetime, last_snapshot: datetime | None) -> bool:
    """Poll during trading hours; otherwise capture once per day and after close."""
    local_now = now.astimezone(VN_TZ)
    if last_snapshot is None:
        return True
    last_local = last_snapshot.astimezone(VN_TZ)
    morning = time(9, 0) <= local_now.time() < time(11, 30)
    afternoon = time(13, 0) <= local_now.time() < time(15, 15)
    if local_now.weekday() < 5 and (morning or afternoon):
        return True
    if last_local.date() != local_now.date():
        return True
    return (local_now.weekday() < 5 and local_now.time() >= time(15, 45)
            and last_local.time() < time(15, 45))


def _positive_price(value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) and number > 0 else None


def normalize_quote_board(frame: pd.DataFrame, directory: list[tuple[str, str | None, str | None, str | None]]) -> list[dict]:
    """Keep every listed symbol, including symbols with no usable quote."""
    quoted: dict[str, dict] = {}
    if frame is not None and not frame.empty:
        for row in frame.to_dict(orient="records"):
            code = str(row.get("symbol") or "").strip().upper()
            if code:
                quoted[code] = row
    items = []
    for code, name, exchange, sector in directory:
        row = quoted.get(code, {})
        price = _positive_price(row.get("close_price"))
        reference = _positive_price(row.get("reference_price"))
        change = price - reference if price is not None and reference is not None else None
        items.append({
            "symbol": code, "name": name, "exchange": exchange, "sector": sector,
            "price": price, "referencePrice": reference, "change": change,
            "percentChange": change / reference * 100 if change is not None and reference else None,
        })
    return items


async def ingest_quote_board() -> dict[str, int | str]:
    provider = get_market_provider()
    if provider.source_id != "vnstock":
        raise RuntimeError("Full quote board requires the Vnstock provider")
    async with AsyncSessionLocal() as session:
        directory = (await session.execute(
            select(Symbol.symbol, Symbol.name, Symbol.exchange, Symbol.sector)
            .where(Symbol.is_active.is_(True), Symbol.exchange.in_(("HOSE", "HNX", "UPCOM")))
            .order_by(Symbol.symbol)
        )).all()
    if not directory:
        raise RuntimeError("Symbol directory is not ready")
    frame = await call_with_retry(provider.get_quote_snapshot, [row[0] for row in directory], timeout_s=30)
    if frame is None or frame.empty or "symbol" not in frame.columns:
        raise RuntimeError("Vnstock quote board returned no usable symbols")
    items = normalize_quote_board(frame, directory)
    quoted_count = sum(item["price"] is not None for item in items)
    returned = {str(code).strip().upper() for code in frame["symbol"].dropna()}
    returned_count = len(returned.intersection(row[0] for row in directory))
    if returned_count < len(directory) * 0.8 or not quoted_count:
        raise RuntimeError(f"Vnstock quote board was incomplete: {returned_count}/{len(directory)} symbols")
    captured_at = datetime.now(timezone.utc)
    async with AsyncSessionLocal.begin() as session:
        await session.execute(delete(MarketSnapshot).where(
            MarketSnapshot.payload["source"].as_string() == provider.source_id
        ))
        session.add(MarketSnapshot(as_of=captured_at, payload={
            "source": provider.source_id, "quoteSource": str(frame.attrs.get("source") or "unknown"),
            "items": items,
        }))
    return {"source": provider.source_id, "symbols": len(directory), "returned": returned_count,
            "quoted": quoted_count,
            "capturedAt": captured_at.isoformat()}
