from datetime import date

import pandas as pd

from providers.csv_seed_provider import CsvSeedProvider


def test_csv_seed_provider_filters_daily_bars_with_date_bounds():
    provider = CsvSeedProvider()

    bars = provider.get_ohlcv("VCB", date(2026, 10, 1), date(2026, 10, 5))
    index_bars = provider.get_index_history("VNINDEX", date(2026, 10, 1), date(2026, 10, 5))

    assert not bars.empty
    assert not index_bars.empty
    assert bars["trade_date"].min() >= pd.Timestamp("2026-10-01")
    assert bars["trade_date"].max() <= pd.Timestamp("2026-10-05")
    assert index_bars["trade_date"].min() >= pd.Timestamp("2026-10-01")
    assert index_bars["trade_date"].max() <= pd.Timestamp("2026-10-05")
