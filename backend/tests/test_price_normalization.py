from datetime import date
from types import SimpleNamespace

import pandas as pd

from jobs.ingest_prices import _bars_for
from domain.provider_status import market_data_status
from providers.csv_seed_provider import CsvSeedProvider


def test_csv_seed_prices_keep_vnd_units_and_explicit_source():
    frame = pd.DataFrame({
        "trade_date": ["2026-11-04"],
        "open": [62_000],
        "high": [63_000],
        "low": [61_000],
        "close": [62_500],
        "volume": [100],
    })

    bars = _bars_for("VCB", frame, CsvSeedProvider())

    assert bars == [{
        "symbol": "VCB", "trade_date": date(2026, 11, 4), "open": 62_000.0,
        "high": 63_000.0, "low": 61_000.0, "close": 62_500.0,
        "volume": 100, "adjusted_close": None, "source": "csv-demo",
    }]


def test_provider_multiplier_is_explicit_and_missing_volume_stays_null():
    provider = SimpleNamespace(source_id="vnstock", stock_price_multiplier=1000.0)
    frame = pd.DataFrame({"time": ["2026-11-04"], "open": [62.0], "high": [63.0],
                          "low": [61.0], "close": [62.5]})

    bars = _bars_for("VCB", frame, provider)

    assert bars[0]["close"] == 62_500
    assert bars[0]["volume"] is None
    assert bars[0]["adjusted_close"] is None
    assert bars[0]["source"] == "vnstock"


def test_adjusted_close_is_scaled_and_kept_separate_from_raw_close():
    provider = SimpleNamespace(source_id="vnstock", stock_price_multiplier=1000.0)
    frame = pd.DataFrame({"time": ["2026-11-04"], "close": [62.5], "adj_close": [60.0]})

    bars = _bars_for("VCB", frame, provider)

    assert bars[0]["close"] == 62_500
    assert bars[0]["adjusted_close"] == 60_000


def test_duplicate_dates_are_deduplicated_to_last_provider_row():
    frame = pd.DataFrame({"date": ["2026-11-04", "2026-11-04"], "close": [62_000, 62_500]})
    provider = SimpleNamespace(source_id="csv-demo", stock_price_multiplier=1.0)

    bars = _bars_for("VCB", frame, provider)

    assert len(bars) == 1
    assert bars[0]["close"] == 62_500


def test_index_points_are_not_scaled_by_stock_price_multiplier():
    provider = SimpleNamespace(source_id="vnstock", stock_price_multiplier=1000.0)
    frame = pd.DataFrame({"time": ["2026-11-04"], "close": [1_500.25]})

    bars = _bars_for("VNINDEX", frame, provider, is_index=True)

    assert bars[0]["close"] == 1_500.25


def test_nan_fields_do_not_drop_an_entire_symbol():
    provider = SimpleNamespace(source_id="vnstock", stock_price_multiplier=1000.0)
    frame = pd.DataFrame({
        "time": ["2026-11-04", "2026-11-05", "2026-11-06"],
        "open": [float("nan"), 62.0, 63.0],
        "high": [63.0, float("nan"), 64.0],
        "low": [61.0, 61.0, float("nan")],
        "close": [62.5, float("nan"), 63.5],
        "adj_close": [float("nan"), 61.0, 62.0],
    })

    bars = _bars_for("FPT", frame, provider)

    assert len(bars) == 2
    assert bars[0]["open"] is None
    assert bars[0]["adjusted_close"] is None
    assert bars[1]["low"] is None
    assert bars[1]["adjusted_close"] == 62_000


def test_market_data_status_distinguishes_missing_current_and_stale_data():
    assert market_data_status(False, None) == ("no_data", False)
    assert market_data_status(True, "success") == ("current", False)
    assert market_data_status(True, "partial") == ("stale", True)
    assert market_data_status(True, "failed") == ("stale", True)
    assert market_data_status(True, None) == ("stale", True)
