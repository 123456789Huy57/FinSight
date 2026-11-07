import asyncio
import math
from datetime import date, datetime, timezone
from typing import Any
import uuid

import pandas as pd
from sqlalchemy.dialects.postgresql import insert

from core.config import settings
from db.models import IndexBar, PriceBar, ProviderJobRun, Symbol
from db.session import AsyncSessionLocal
from domain.text import normalize_vi
from providers.base import MarketDataProvider
from providers.factory import get_market_provider


def _column(frame: pd.DataFrame, candidates: tuple[str, ...]) -> str | None:
    return next((name for name in candidates if name in frame.columns), None)


def _float(value: Any) -> float | None:
    try:
        number = float(value)
        return number if pd.notna(number) and math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def _scaled_float(value: Any, scale: float) -> float | None:
    number = _float(value)
    return number * scale if number is not None else None


def _bars_for(
    symbol: str,
    frame: pd.DataFrame,
    provider: MarketDataProvider,
    *,
    is_index: bool = False,
) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []
    date_col = _column(frame, ("time", "date", "Date", "trade_date"))
    close_col = _column(frame, ("close", "Close", "close_price"))
    if not date_col or not close_col:
        raise ValueError("OHLCV response is missing date or close column")

    price_columns = {
        "open": _column(frame, ("open", "Open", "open_price")),
        "high": _column(frame, ("high", "High", "high_price")),
        "low": _column(frame, ("low", "Low", "low_price")),
        "close": close_col,
    }
    adjusted_close_col = None if is_index else _column(
        frame, ("adjusted_close", "adj_close", "adjclose", "adjClose")
    )
    scale = 1.0 if is_index else float(provider.stock_price_multiplier)
    volume_col = _column(frame, ("volume", "Volume"))
    records_by_date: dict[date, dict[str, Any]] = {}
    for _, row in frame.iterrows():
        timestamp = pd.to_datetime(row.get(date_col), errors="coerce")
        close = _float(row.get(close_col))
        if pd.isna(timestamp) or close is None:
            continue
        if timestamp.tzinfo is not None:
            timestamp = timestamp.tz_convert("Asia/Ho_Chi_Minh")
        if close <= 0:
            continue
        volume = _float(row.get(volume_col)) if volume_col else None
        adjusted_close = _scaled_float(row.get(adjusted_close_col), scale) if adjusted_close_col else None
        if adjusted_close is not None and adjusted_close <= 0:
            adjusted_close = None
        records_by_date[timestamp.date()] = {
            "symbol": symbol,
            "trade_date": timestamp.date(),
            **{key: _scaled_float(row.get(column), scale) if column else None
               for key, column in price_columns.items()},
            "volume": int(volume) if volume is not None and math.isfinite(volume) else None,
            "adjusted_close": adjusted_close,
            "source": provider.source_id,
        }
    return [records_by_date[key] for key in sorted(records_by_date)]


async def ingest_price_history(
    start: date,
    end: date,
    symbols: list[str] | None = None,
    request_delay_seconds: float | None = None,
) -> dict[str, int | str]:
    provider = get_market_provider()
    if request_delay_seconds is None:
        request_delay_seconds = (settings.vnstock_request_delay_seconds
                                 if provider.source_id == "vnstock" else 0.15)
    run_id = str(uuid.uuid4())
    async with AsyncSessionLocal.begin() as session:
        session.add(ProviderJobRun(
            id=run_id, source=provider.source_id, job_name="price-history", status="running",
        ))
    try:
        result = await _ingest_price_history(provider, start, end, symbols, request_delay_seconds)
    except Exception as exc:
        try:
            await _finish_provider_run(run_id, "failed", None, str(exc))
        except Exception as status_exc:
            print(f"Unable to record failed provider run {run_id}: {status_exc}", flush=True)
        raise
    failed = sum(int(result.get(key, 0)) for key in
                 ("failed_symbols", "failed_indices", "empty_symbols", "empty_indices"))
    await _finish_provider_run(run_id, "partial" if failed else "success", result, None)
    result["runId"] = run_id
    return result


async def _finish_provider_run(
    run_id: str,
    status: str,
    summary: dict[str, int | str] | None,
    error: str | None,
) -> None:
    async with AsyncSessionLocal.begin() as session:
        run = await session.get(ProviderJobRun, run_id)
        if run is None:
            return
        run.status = status
        run.finished_at = datetime.now(timezone.utc)
        run.summary = summary
        run.error = error[:2000] if error else None


async def _ingest_price_history(
    provider: MarketDataProvider,
    start: date,
    end: date,
    symbols: list[str] | None,
    request_delay_seconds: float,
) -> dict[str, int | str]:
    listing = await asyncio.to_thread(provider.list_symbols)
    if listing.empty:
        raise RuntimeError("Selected market provider returned no symbols")

    symbol_col = _column(listing, ("symbol",))
    if not symbol_col:
        raise RuntimeError("Provider symbol list has no symbol column")
    listing = listing.copy()
    listing[symbol_col] = listing[symbol_col].astype(str).str.strip().str.upper()
    if symbols:
        requested = {value.upper() for value in symbols}
        listing = listing.loc[listing[symbol_col].isin(requested)]

    symbol_records = []
    for row in listing.to_dict(orient="records"):
        symbol_records.append({
            "symbol": row[symbol_col],
            "name": row.get("name") or row.get("organ_name"),
            "search_text": normalize_vi(" ".join(str(value) for value in
                                                    (row[symbol_col], row.get("name") or row.get("organ_name"), row.get("sector"))
                                                    if value)),
            "exchange": row.get("exchange"),
            "sector": row.get("sector"),
            "is_active": True,
        })
    if not symbol_records:
        raise ValueError("No listed symbols matched the requested filter")

    async with AsyncSessionLocal.begin() as session:
        statement = insert(Symbol).values(symbol_records)
        await session.execute(statement.on_conflict_do_update(
            index_elements=[Symbol.symbol],
            set_={
                "name": statement.excluded.name,
                "search_text": statement.excluded.search_text,
                "exchange": statement.excluded.exchange,
                "sector": statement.excluded.sector,
                "is_active": True,
            },
        ))

    result: dict[str, int | str] = {"symbols": len(symbol_records), "bars": 0, "failed_symbols": 0,
                                    "index_bars": 0, "failed_indices": 0, "empty_symbols": 0,
                                    "empty_indices": 0}
    result["source"] = provider.source_id
    result["dataMode"] = provider.data_mode
    for index, symbol_row in enumerate(symbol_records):
        symbol = symbol_row["symbol"]
        try:
            frame = await asyncio.to_thread(provider.get_ohlcv, symbol, start, end, "1D")
            records = _bars_for(symbol, frame, provider)
            if records:
                async with AsyncSessionLocal.begin() as session:
                    statement = insert(PriceBar).values(records)
                    await session.execute(statement.on_conflict_do_update(
                        index_elements=[PriceBar.symbol, PriceBar.trade_date, PriceBar.source],
                        set_={
                            "open": statement.excluded.open,
                            "high": statement.excluded.high,
                            "low": statement.excluded.low,
                            "close": statement.excluded.close,
                            "adjusted_close": statement.excluded.adjusted_close,
                            "volume": statement.excluded.volume,
                            "source": statement.excluded.source,
                        },
                    ))
                result["bars"] += len(records)
            else:
                result["empty_symbols"] += 1
        except Exception as exc:
            result["failed_symbols"] += 1
            print(f"OHLCV ingestion failed for {symbol}: {exc}", flush=True)
        if request_delay_seconds and index < len(symbol_records) - 1:
            await asyncio.sleep(request_delay_seconds)

    for index_symbol in ("VNINDEX", "HNXINDEX", "UPCOMINDEX"):
        try:
            frame = await asyncio.to_thread(provider.get_index_history, index_symbol, start, end)
            if frame is None or frame.empty:
                result["empty_indices"] += 1
                continue
            normalized = frame.copy()
            normalized["symbol"] = index_symbol
            rows = _bars_for(index_symbol, normalized, provider, is_index=True)
            records = [{
                "index_symbol": row["symbol"],
                "trade_date": row["trade_date"],
                "open": row["open"], "high": row["high"], "low": row["low"],
                "close": row["close"], "volume": row["volume"], "source": provider.source_id,
            } for row in rows]
            if records:
                async with AsyncSessionLocal.begin() as session:
                    statement = insert(IndexBar).values(records)
                    await session.execute(statement.on_conflict_do_update(
                        index_elements=[IndexBar.index_symbol, IndexBar.trade_date, IndexBar.source],
                        set_={key: getattr(statement.excluded, key) for key in
                              ("open", "high", "low", "close", "volume", "source")},
                    ))
                result["index_bars"] = result.get("index_bars", 0) + len(records)
        except Exception as exc:
            result["failed_indices"] += 1
            print(f"Index history ingestion failed for {index_symbol}: {exc}", flush=True)
    return result
