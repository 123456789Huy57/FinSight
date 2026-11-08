from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import api.v1.market as market_api


def test_health_endpoint(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_market_status_contract(client) -> None:
    response = client.get("/api/v1/market/status")
    assert response.status_code == 200
    payload = response.json()
    assert {"is_open", "session", "server_time", "weekday"} <= payload.keys()


def test_index_history_contract_and_unknown_symbol(monkeypatch, client) -> None:
    bars = [
        SimpleNamespace(trade_date=date(2026, 11, day), open=Decimal("1200.50"),
                        high=Decimal("1210.25"), low=None, close=Decimal("1205.75"),
                        volume=1000, source="vnstock")
        for day in (6, 5)
    ]

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def scalars(self, statement):
            return SimpleNamespace(all=lambda: bars)

    monkeypatch.setattr(market_api, "AsyncSessionLocal", FakeSession)
    monkeypatch.setattr(market_api, "get_configured_market_source_id", lambda: "vnstock")

    response = client.get("/api/v1/market/indices/vnindex/history?limit=2")
    unknown = client.get("/api/v1/market/indices/OTHER/history")
    route = client.get("/openapi.json").json()["paths"]["/api/v1/market/indices/{symbol}/history"]

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "VNINDEX"
    assert payload["asOf"] == "2026-11-06"
    assert payload["source"] == "vnstock"
    assert payload["dataMode"] == "market-provider"
    assert [candle["time"] for candle in payload["items"]] == ["2026-11-05", "2026-11-06"]
    assert payload["items"][-1] == {
        "time": "2026-11-06", "open": 1200.5, "high": 1210.25, "low": None,
        "close": 1205.75, "volume": 1000, "source": "vnstock", "dataMode": "market-provider",
    }
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "SYMBOL_NOT_FOUND"
    assert "get" in route
