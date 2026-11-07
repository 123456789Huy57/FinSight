from datetime import date, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from domain.event_study import calculate_event_study

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
DATES = [
    date(2026, 11, 6), date(2026, 11, 9), date(2026, 11, 10),
    date(2026, 11, 11), date(2026, 11, 12), date(2026, 11, 13),
    date(2026, 11, 16),
]
STOCK_CLOSES = [100, 110, 121, 133.1, 146.41, 161.051, 177.1561]
INDEX_CLOSES = [1000, 1000, 1005, 1010, 1015, 1020, 1030]


def _bars(dates=DATES, stock_closes=STOCK_CLOSES, index_closes=INDEX_CLOSES):
    stock = [
        SimpleNamespace(trade_date=day, close=close, adjusted_close=close)
        for day, close in zip(dates, stock_closes, strict=True)
    ]
    index = [SimpleNamespace(trade_date=day, close=close) for day, close in zip(dates, index_closes, strict=True)]
    return stock, index


def _calculate(published_at, *, stock=None, index=None, **kwargs):
    default_stock, default_index = _bars()
    return calculate_event_study(
        article_id="article-1",
        symbol="HPG",
        published_at=published_at,
        stock_bars=default_stock if stock is None else stock,
        benchmark_bars=default_index if index is None else index,
        data_mode=kwargs.pop("data_mode", "market-provider"),
        price_source="test-price-provider",
        benchmark_source="test-price-provider",
        **kwargs,
    )


def test_hand_calculated_t1_and_t5_returns_use_vnindex_same_dates():
    result = _calculate(datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ))

    assert result["event_trade_date"] == date(2026, 11, 9)
    assert result["t1_status"] == "measured"
    assert round(result["t1_return_pct"], 6) == 10
    assert round(result["t1_benchmark_return_pct"], 6) == 0.5
    assert round(result["t1_abnormal_return_pct"], 6) == 9.5
    assert result["t5_end_date"] == date(2026, 11, 16)
    assert round(result["t5_return_pct"], 3) == 61.051
    assert round(result["t5_benchmark_return_pct"], 3) == 3
    assert round(result["t5_abnormal_return_pct"], 3) == 58.051


def test_before_close_uses_same_day_close_and_weekend_moves_to_next_session():
    before_close = _calculate(datetime(2026, 11, 6, 8, 0, tzinfo=VN_TZ))
    weekend = _calculate(datetime(2026, 11, 7, 10, 0, tzinfo=VN_TZ))

    assert before_close["event_trade_date"] == date(2026, 11, 6)
    assert before_close["t1_end_date"] == date(2026, 11, 9)
    assert weekend["event_trade_date"] == date(2026, 11, 9)


def test_missing_future_session_is_pending_and_missing_benchmark_is_insufficient():
    short_stock, short_index = _bars(DATES[:2], STOCK_CLOSES[:2], INDEX_CLOSES[:2])
    pending = _calculate(datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ), stock=short_stock, index=short_index)

    stock, index = _bars()
    index_without_t1 = [bar for bar in index if bar.trade_date != date(2026, 11, 10)]
    missing_benchmark = _calculate(
        datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ), stock=stock, index=index_without_t1
    )
    no_benchmark = _calculate(datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ), stock=stock, index=[])

    assert pending["t1_status"] == "pending"
    assert pending["t1_reason"] == "awaiting_trading_sessions"
    assert missing_benchmark["t1_status"] == "insufficient_data"
    assert missing_benchmark["t1_reason"] == "benchmark_bar_missing"
    assert missing_benchmark["t1_return_pct"] is None
    assert no_benchmark["t1_status"] == "insufficient_data"
    assert no_benchmark["t1_reason"] == "benchmark_bar_missing"


def test_overlapping_events_withhold_window_returns():
    result = _calculate(
        datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ),
        other_event_dates=[date(2026, 11, 10)],
    )

    assert result["t1_status"] == "overlapping_event"
    assert result["t5_status"] == "overlapping_event"
    assert result["t1_return_pct"] is None
    assert result["t5_return_pct"] is None


def test_synthetic_or_unadjusted_stock_prices_never_emit_measured_returns():
    synthetic = _calculate(datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ), data_mode="synthetic-demo")
    stock, index = _bars()
    stock[1].adjusted_close = None
    missing_adjusted_close = _calculate(
        datetime(2026, 11, 6, 16, 0, tzinfo=VN_TZ), stock=stock, index=index
    )

    assert synthetic["t1_status"] == "insufficient_data"
    assert synthetic["t1_reason"] == "synthetic_price_source"
    assert synthetic["t1_return_pct"] is None
    assert missing_adjusted_close["t1_status"] == "insufficient_data"
    assert missing_adjusted_close["t1_reason"] == "adjusted_close_unavailable"
