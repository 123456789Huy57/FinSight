from datetime import date

import pandas as pd
import pytest

from core.config import settings
from providers import vnstock_provider


def test_symbol_directory_is_limited_to_configured_tickers(monkeypatch):
    class Equity:
        def list_by_exchange(self):
            return pd.DataFrame({
                "symbol": ["FPT", "HPG", "AAA"],
                "organ_name": ["FPT", "Hoa Phat", "An Phat"],
                "exchange": ["HOSE", "HOSE", "HOSE"],
            })

        def list_by_industry(self):
            return pd.DataFrame()

    class Reference:
        equity = Equity()

    monkeypatch.setattr(vnstock_provider, "_vnstock_types", lambda: (None, Reference))
    monkeypatch.setattr(settings, "vnstock_symbols", "FPT,HPG")

    symbols = vnstock_provider.VnstockProvider().list_symbols()

    assert symbols["symbol"].tolist() == ["FPT", "HPG"]
    assert "AAA" not in symbols["symbol"].tolist()


def test_all_symbols_includes_active_exchanges_and_excludes_delisted(monkeypatch):
    class Equity:
        def list_by_exchange(self):
            return pd.DataFrame({
                "symbol": ["FPT", "MBB", "IDC", "ACB", "OLD"],
                "organ_name": ["FPT", "MBB", "IDC", "ACB", "Old"],
                "exchange": ["HOSE", "HOSE", "HNX", "UPCOM", "DELISTED"],
            })

        def list_by_industry(self):
            return pd.DataFrame()

    class Reference:
        equity = Equity()

    monkeypatch.setattr(vnstock_provider, "_vnstock_types", lambda: (None, Reference))
    monkeypatch.setattr(settings, "vnstock_symbols", "ALL")

    symbols = vnstock_provider.VnstockProvider().list_symbols()

    assert symbols["symbol"].tolist() == ["FPT", "MBB", "IDC", "ACB"]


def test_vci_adjusted_close_is_kept_for_event_study(monkeypatch):
    class Equity:
        def ohlcv(self, **kwargs):
            assert kwargs["source"] == "vci"
            return pd.DataFrame({"time": ["2026-11-04"], "close": [62.5]})

    class Market:
        def equity(self, symbol):
            assert symbol == "FPT"
            return Equity()

    monkeypatch.setattr(vnstock_provider, "_vnstock_types", lambda: (Market, None))

    frame = vnstock_provider.VnstockProvider().get_ohlcv("fpt", date(2026, 11, 1), date(2026, 11, 4))

    assert frame["adjusted_close"].tolist() == [62.5]


def test_truncated_vnstock_history_is_rejected(monkeypatch):
    class Equity:
        def ohlcv(self, **kwargs):
            frame = pd.DataFrame({"time": ["2026-11-04"], "close": [62.5]})
            frame.attrs["tier_cap_history_days"] = 365
            return frame

    class Market:
        def equity(self, symbol):
            return Equity()

    monkeypatch.setattr(vnstock_provider, "_vnstock_types", lambda: (Market, None))

    with pytest.raises(RuntimeError, match="truncated"):
        vnstock_provider.VnstockProvider().get_ohlcv("FPT", date(2024, 1, 1), date(2026, 11, 4))
