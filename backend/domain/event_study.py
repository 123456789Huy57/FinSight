"""Daily-close event-study calculations for observable, non-causal returns."""

from __future__ import annotations

import math
from datetime import date, datetime, time, timezone
from typing import Any, Iterable
from zoneinfo import ZoneInfo

METHOD_VERSION = "daily-close-v1"
BENCHMARK_SYMBOL = "VNINDEX"
MARKET_CLOSE = time(15, 0)
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _number(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) and parsed > 0 else None


def _event_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=VN_TZ)
    return value.astimezone(VN_TZ)


def _bar_date(bar: Any) -> date:
    return bar.trade_date


def _event_bar_index(published_at: datetime, stock_bars: list[Any]) -> int | None:
    event_time = _event_datetime(published_at)
    if event_time is None:
        return None
    same_day_close_is_after_event = event_time.time().replace(tzinfo=None) < MARKET_CLOSE
    for index, bar in enumerate(stock_bars):
        trade_date = _bar_date(bar)
        if trade_date > event_time.date() or (same_day_close_is_after_event and trade_date == event_time.date()):
            return index
    return None


def event_trade_date_for_published_at(published_at: datetime | None, stock_bars: Iterable[Any]) -> date | None:
    """Return the first available daily close strictly after a story timestamp."""
    if published_at is None:
        return None
    bars = sorted(stock_bars, key=_bar_date)
    index = _event_bar_index(published_at, bars)
    return _bar_date(bars[index]) if index is not None else None


def _empty_window(status: str, reason: str, end_date: date | None = None) -> dict[str, Any]:
    return {
        "status": status,
        "end_date": end_date,
        "adjusted_close": None,
        "benchmark_close": None,
        "return_pct": None,
        "benchmark_return_pct": None,
        "abnormal_return_pct": None,
        "reason": reason,
    }


def _measure_window(
    *,
    horizon: int,
    event_index: int,
    stock_bars: list[Any],
    benchmark_by_date: dict[date, Any],
    event_date: date,
    event_adjusted_close: float | None,
    benchmark_event_close: float | None,
    other_event_dates: set[date],
) -> dict[str, Any]:
    target_index = event_index + horizon
    if target_index >= len(stock_bars):
        return _empty_window("pending", "awaiting_trading_sessions")

    target_bar = stock_bars[target_index]
    target_date = _bar_date(target_bar)
    adjusted_close = _number(getattr(target_bar, "adjusted_close", None))
    if event_adjusted_close is None or adjusted_close is None:
        return _empty_window("insufficient_data", "adjusted_close_unavailable", target_date)

    target_benchmark = benchmark_by_date.get(target_date)
    if benchmark_event_close is None or target_benchmark is None:
        latest_benchmark_date = max(benchmark_by_date, default=None)
        if latest_benchmark_date is None or benchmark_event_close is None:
            return _empty_window("insufficient_data", "benchmark_bar_missing", target_date)
        if latest_benchmark_date < target_date:
            return _empty_window("pending", "awaiting_benchmark", target_date)
        return _empty_window("insufficient_data", "benchmark_bar_missing", target_date)
    target_benchmark_close = _number(getattr(target_benchmark, "close", None))
    if target_benchmark_close is None:
        return _empty_window("insufficient_data", "benchmark_close_unavailable", target_date)

    stock_return = (adjusted_close / event_adjusted_close - 1.0) * 100
    benchmark_return = (target_benchmark_close / benchmark_event_close - 1.0) * 100
    if any(event_date <= other_date <= target_date for other_date in other_event_dates):
        return {
            **_empty_window("overlapping_event", "another_linked_event_in_window", target_date),
        }
    return {
        "status": "measured",
        "end_date": target_date,
        "adjusted_close": adjusted_close,
        "benchmark_close": target_benchmark_close,
        "return_pct": stock_return,
        "benchmark_return_pct": benchmark_return,
        "abnormal_return_pct": stock_return - benchmark_return,
        "reason": None,
    }


def calculate_event_study(
    *,
    article_id: str,
    symbol: str,
    published_at: datetime | None,
    stock_bars: Iterable[Any],
    benchmark_bars: Iterable[Any],
    data_mode: str,
    price_source: str | None,
    benchmark_source: str | None,
    other_event_dates: Iterable[date] = (),
    calculated_at: datetime | None = None,
    method_version: str = METHOD_VERSION,
) -> dict[str, Any]:
    """Measure adjusted-close returns from event close through T+1 and T+5.

    The event close is the first daily close strictly after publication. A
    publication before 15:00 Vietnam time can use that date's close; a later
    publication waits for the next available trading bar. Synthetic prices,
    missing adjusted closes, and missing benchmark bars never produce returns.
    """
    stock = sorted(stock_bars, key=_bar_date)
    benchmark = {bar.trade_date: bar for bar in benchmark_bars}
    published = _event_datetime(published_at)
    event_index = _event_bar_index(published, stock) if published else None
    event_bar = stock[event_index] if event_index is not None else None
    event_date = _bar_date(event_bar) if event_bar is not None else None
    event_adjusted_close = _number(getattr(event_bar, "adjusted_close", None)) if event_bar else None
    benchmark_event_bar = benchmark.get(event_date) if event_date else None
    benchmark_event_close = _number(getattr(benchmark_event_bar, "close", None)) if benchmark_event_bar else None
    overlap_dates = set(other_event_dates)

    if published is None:
        t1 = _empty_window("insufficient_data", "published_at_unavailable")
        t5 = _empty_window("insufficient_data", "published_at_unavailable")
    elif data_mode == "synthetic-demo":
        t1 = _empty_window("insufficient_data", "synthetic_price_source")
        t5 = _empty_window("insufficient_data", "synthetic_price_source")
    elif not stock:
        t1 = _empty_window("insufficient_data", "price_history_unavailable")
        t5 = _empty_window("insufficient_data", "price_history_unavailable")
    elif event_index is None:
        latest_date = _bar_date(stock[-1])
        status = "pending" if latest_date <= published.date() else "insufficient_data"
        reason = "awaiting_event_session" if status == "pending" else "event_session_missing"
        t1 = _empty_window(status, reason)
        t5 = _empty_window(status, reason)
    else:
        assert event_date is not None
        t1 = _measure_window(
            horizon=1,
            event_index=event_index,
            stock_bars=stock,
            benchmark_by_date=benchmark,
            event_date=event_date,
            event_adjusted_close=event_adjusted_close,
            benchmark_event_close=benchmark_event_close,
            other_event_dates=overlap_dates,
        )
        t5 = _measure_window(
            horizon=5,
            event_index=event_index,
            stock_bars=stock,
            benchmark_by_date=benchmark,
            event_date=event_date,
            event_adjusted_close=event_adjusted_close,
            benchmark_event_close=benchmark_event_close,
            other_event_dates=overlap_dates,
        )

    statuses = {t1["status"], t5["status"]}
    overall_status = (
        "overlapping_event" if "overlapping_event" in statuses else
        "measured" if statuses == {"measured"} else
        "pending" if "pending" in statuses else
        "insufficient_data"
    )
    return {
        "article_id": article_id,
        "symbol": symbol.upper(),
        "method_version": method_version,
        "benchmark_symbol": BENCHMARK_SYMBOL,
        "data_mode": data_mode,
        "price_source": price_source,
        "benchmark_source": benchmark_source,
        "event_trade_date": event_date,
        "event_adjusted_close": event_adjusted_close,
        "benchmark_event_close": benchmark_event_close,
        "t1_status": t1["status"],
        "t1_end_date": t1["end_date"],
        "t1_adjusted_close": t1["adjusted_close"],
        "t1_benchmark_close": t1["benchmark_close"],
        "t1_return_pct": t1["return_pct"],
        "t1_benchmark_return_pct": t1["benchmark_return_pct"],
        "t1_abnormal_return_pct": t1["abnormal_return_pct"],
        "t1_reason": t1["reason"],
        "t5_status": t5["status"],
        "t5_end_date": t5["end_date"],
        "t5_adjusted_close": t5["adjusted_close"],
        "t5_benchmark_close": t5["benchmark_close"],
        "t5_return_pct": t5["return_pct"],
        "t5_benchmark_return_pct": t5["benchmark_return_pct"],
        "t5_abnormal_return_pct": t5["abnormal_return_pct"],
        "t5_reason": t5["reason"],
        "calculated_at": calculated_at or datetime.now(timezone.utc),
        "status": overall_status,
        "t1": t1,
        "t5": t5,
    }
