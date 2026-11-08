from datetime import datetime, timezone
from types import SimpleNamespace

import pandas as pd

import api.v1.market as market_api
from jobs.ingest_quotes import VN_TZ, normalize_quote_board, quote_refresh_due


def test_quote_refresh_uses_five_minute_poll_only_in_trading_hours():
    sunday = datetime(2026, 11, 8, 13, 0, tzinfo=VN_TZ)
    monday_open = datetime(2026, 11, 9, 10, 0, tzinfo=VN_TZ)
    monday_close = datetime(2026, 11, 9, 15, 50, tzinfo=VN_TZ)
    assert quote_refresh_due(sunday, None)
    assert not quote_refresh_due(sunday, datetime(2026, 11, 8, 12, 0, tzinfo=VN_TZ))
    assert quote_refresh_due(monday_open, datetime(2026, 11, 9, 9, 55, tzinfo=VN_TZ))
    assert not quote_refresh_due(datetime(2026, 11, 9, 12, 0, tzinfo=VN_TZ),
                                 datetime(2026, 11, 9, 11, 25, tzinfo=VN_TZ))
    assert quote_refresh_due(monday_close, datetime(2026, 11, 9, 15, 0, tzinfo=VN_TZ))
    assert not quote_refresh_due(monday_close, datetime(2026, 11, 9, 15, 47, tzinfo=VN_TZ))


def test_normalize_quote_board_preserves_unpriced_symbols_and_vnd_units():
    frame = pd.DataFrame([
        {"symbol": "FPT", "close_price": 50_800, "reference_price": 52_900},
        {"symbol": "VCB", "close_price": float("nan"), "reference_price": 54_200},
    ])
    directory = [("FPT", "FPT Corp", "HOSE", "Công nghệ"),
                 ("VCB", "Vietcombank", "HOSE", "Ngân hàng"),
                 ("ACB", "ACB", "HNX", "Ngân hàng")]

    items = normalize_quote_board(frame, directory)

    assert len(items) == 3
    assert items[0]["price"] == 50_800
    assert items[0]["referencePrice"] == 52_900
    assert items[0]["change"] == -2_100
    assert round(items[0]["percentChange"], 2) == -3.97
    assert items[1]["price"] is None
    assert items[1]["referencePrice"] == 54_200
    assert items[2]["price"] is None


def test_board_route_uses_saved_snapshot_without_provider_call(monkeypatch, client):
    snapshot = SimpleNamespace(as_of=datetime.now(timezone.utc), payload={
        "source": "vnstock", "quoteSource": "kbs", "items": [
            {"symbol": "FPT", "name": "FPT", "exchange": "HOSE", "sector": None,
             "price": 50_800, "change": -2_100, "percentChange": -3.97},
        ],
    })

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def scalar(self, statement):
            return snapshot

    monkeypatch.setattr(market_api, "AsyncSessionLocal", FakeSession)
    monkeypatch.setattr(market_api, "get_configured_market_source_id", lambda: "vnstock")

    response = client.get("/api/v1/market/board")
    payload = response.json()
    assert response.status_code == 200
    assert payload["total"] == 1
    assert payload["items"][0]["price"] == 50_800
    assert payload["quoteSource"] == "kbs"
    assert payload["status"] == "current"
