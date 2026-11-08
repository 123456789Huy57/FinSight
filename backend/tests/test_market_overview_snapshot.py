import asyncio
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import api.v1.market as market_api


def test_overview_uses_whole_quote_snapshot_without_inventing_volume(monkeypatch):
    async def board():
        return {
            "items": [
                {"symbol": "AAA", "sector": "Ngân hàng", "price": 10_000,
                 "change": 500, "percentChange": 5.0},
                {"symbol": "BBB", "sector": "Ngân hàng", "price": 20_000,
                 "change": -200, "percentChange": -1.0},
                {"symbol": "CCC", "sector": "Công nghệ", "price": None,
                 "change": None, "percentChange": None},
            ],
            "source": "vnstock", "dataMode": "market-provider",
            "snapshotAt": "2026-11-08T06:22:58+00:00", "status": "current",
        }

    async def indices():
        return []

    async def no_history_query():
        raise AssertionError("Daily bars must not drive the quote breadth")

    monkeypatch.setattr(market_api, "get_configured_market_source_id", lambda: "vnstock")
    monkeypatch.setattr(market_api, "quote_board", board)
    monkeypatch.setattr(market_api, "_index_rows", indices)
    monkeypatch.setattr(market_api, "_latest_bars", no_history_query)

    result = asyncio.run(market_api.overview())
    assert result["asOf"] == "2026-11-08T06:22:58+00:00"
    assert result["breadth"]["advancing"] == 1
    assert result["breadth"]["declining"] == 1
    assert result["breadth"]["totalVolume"] is None
    assert [item["symbol"] for item in result["movers"]["gainers"]] == ["AAA", "BBB"]
    assert result["sectors"][0]["percentChange"] == 2.0

    async def daily_fallback():
        payload = await board()
        payload["snapshotAt"] = None
        payload["items"][0]["asOf"] = "2026-11-06"
        payload["items"][1]["asOf"] = "2026-11-05"
        return payload

    monkeypatch.setattr(market_api, "quote_board", daily_fallback)
    assert asyncio.run(market_api.overview())["asOf"] == "2026-11-06"


def test_board_marks_daily_fallback_stale_when_quote_snapshot_is_missing(monkeypatch):
    directory_queries = 0

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def scalar(self, statement):
            return None

        async def execute(self, statement):
            nonlocal directory_queries
            directory_queries += 1
            return SimpleNamespace(all=lambda: [
                ("AAA", "AAA Company", "HOSE", "Ngân hàng"),
                ("BBB", "BBB Company", "HNX", "Công nghệ"),
            ])

    async def daily_bars():
        symbol = SimpleNamespace(symbol="AAA", name="AAA Company", exchange="HOSE", sector="Ngân hàng")
        bar = SimpleNamespace(close=Decimal("10000"), volume=1000,
                              trade_date=date(2026, 11, 6), source="vnstock")
        older_symbol = SimpleNamespace(symbol="BBB", name="BBB Company", exchange="HNX", sector="Công nghệ")
        older_bar = SimpleNamespace(close=Decimal("2000"), volume=500,
                                    trade_date=date(2026, 11, 5), source="vnstock")
        return [(symbol, bar, Decimal("9000")), (older_symbol, older_bar, Decimal("1000"))]

    monkeypatch.setattr(market_api, "get_configured_market_source_id", lambda: "vnstock")
    monkeypatch.setattr(market_api, "AsyncSessionLocal", FakeSession)
    monkeypatch.setattr(market_api, "_latest_bars", daily_bars)
    monkeypatch.setattr(market_api, "_fallback_board_cache", None)

    board = asyncio.run(market_api.quote_board())
    assert board["status"] == "stale"
    assert board["quoteSource"] == "vci-eod"
    assert board["total"] == 2
    assert board["items"][0]["price"] == 10_000
    assert board["items"][0]["referencePrice"] is None
    assert board["items"][0]["asOf"] == "2026-11-06"
    assert board["items"][1]["price"] is None
    assert asyncio.run(market_api.quote_board()) == board
    assert directory_queries == 1
