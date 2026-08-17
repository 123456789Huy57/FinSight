from fastapi.testclient import TestClient

from main import app


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_market_status_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/market/status")
    assert response.status_code == 200
    payload = response.json()
    assert {"is_open", "session", "server_time", "weekday"} <= payload.keys()
