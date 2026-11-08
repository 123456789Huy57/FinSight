from api.v1 import meta_ai


def test_v1_meta_and_market_status_replace_legacy_routes(client):
    meta = client.get("/api/v1/meta")
    status = client.get("/api/v1/market/status")
    paths = client.get("/openapi.json").json()["paths"]

    assert meta.status_code == 200
    assert isinstance(meta.json()["ai_enabled"], bool)
    assert "market" in meta.json()
    assert status.status_code == 200
    assert "session" in status.json()
    assert "/api/v1/ai/explain" in paths
    assert "/api/v1/ai/chat" in paths
    assert client.get("/meta/data-sources").status_code == 404
    assert client.get("/market/status").status_code == 404


def test_v1_ai_routes_keep_request_and_response_shapes(client, monkeypatch):
    monkeypatch.setattr(meta_ai, "ai_explain_service", lambda payload: {"title": payload["title"]})
    monkeypatch.setattr(meta_ai, "ai_chat_service", lambda question, context: f"{question}:{context['type']}")

    explanation = client.post("/api/v1/ai/explain", json={"type": "stock", "title": "FPT"})
    chat = client.post("/api/v1/ai/chat", json={"question": "Giá?", "context_type": "stock"})

    assert explanation.status_code == 200
    assert explanation.json() == {"title": "FPT"}
    assert chat.status_code == 200
    assert chat.json() == {"response": "Giá?:stock"}
