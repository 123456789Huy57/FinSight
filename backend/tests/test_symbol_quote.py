import asyncio
import json

from fastapi.responses import JSONResponse

import api.v1.market as market_api
from main import app


def test_symbol_quote_reuses_board_snapshot(monkeypatch):
    calls = 0

    async def board():
        nonlocal calls
        calls += 1
        return {
            "items": [
                {"symbol": "FPT", "price": 50_800, "referencePrice": 52_900},
                {"symbol": "VCB", "price": None, "referencePrice": 54_200},
            ],
            "source": "vnstock", "dataMode": "market-provider", "quoteSource": "kbs",
            "snapshotAt": "2026-11-08T06:22:58+00:00", "status": "current",
        }

    monkeypatch.setattr(market_api, "quote_board", board)
    result = asyncio.run(market_api.symbol_quote(" vcb "))
    assert calls == 1
    assert result["item"] == {"symbol": "VCB", "price": None, "referencePrice": 54_200}
    assert result["quoteSource"] == "kbs"
    assert "/api/v1/market/board/{symbol}" in app.openapi()["paths"]

    missing = asyncio.run(market_api.symbol_quote("UNKNOWN"))
    assert isinstance(missing, JSONResponse)
    assert missing.status_code == 404
    assert json.loads(missing.body)["error"]["code"] == "SYMBOL_NOT_FOUND"
