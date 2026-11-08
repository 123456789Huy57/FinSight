import json

import pandas as pd

from services import ai_service


def test_technical_snapshot_uses_database_vnd_values(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "_read_history",
        lambda symbol: pd.DataFrame({"close": [40_000 + index * 100 for index in range(25)]}),
    )

    snapshot = ai_service._technical_snapshot("FPT")

    assert snapshot is not None
    assert snapshot["last_price"] == 42_400
    assert 40_000 < snapshot["ma20"] < 43_000


def test_chat_enriches_from_persisted_data_without_legacy_provider_calls(monkeypatch):
    captured = {}

    monkeypatch.setattr(ai_service, "_read_quote", lambda symbol: {
        "current_price": 42_400, "volume": 123_000,
    })
    monkeypatch.setattr(ai_service, "_read_history", lambda symbol: pd.DataFrame({
        "close": [40_000 + index * 100 for index in range(25)],
    }))

    def capture(messages):
        captured.update(json.loads(messages[1]["content"]))
        return "Dữ liệu đã được kiểm tra. Kết luận: đây là số liệu quan sát."

    monkeypatch.setattr(ai_service, "_call_openrouter", capture)

    answer = ai_service.chat("Phân tích FPT", context={"symbol": "FPT"})

    enriched = captured["context"]
    assert enriched["snapshot"] == {"last_price": 42_400, "volume": 123_000}
    assert enriched["technical_snapshot"]["last_price"] == 42_400
    assert "Kết luận:" in answer
