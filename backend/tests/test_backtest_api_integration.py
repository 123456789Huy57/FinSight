import uuid

from fastapi.testclient import TestClient

from db.models import User
from db.session import AsyncSessionLocal, engine
from main import app
from sqlalchemy import delete


def _delete_users(ids: list[str]) -> None:
    async def delete_rows() -> None:
        await engine.dispose()
        async with AsyncSessionLocal.begin() as session:
            await session.execute(delete(User).where(User.id.in_(ids)))
        await engine.dispose()

    import asyncio

    asyncio.run(delete_rows())


def test_backtest_result_is_persisted_and_private_to_owner():
    email_root = f"backtest-{uuid.uuid4().hex}"
    accounts = [
        {"email": f"{email_root}-{suffix}@example.test", "password": f"correct-horse-battery-{suffix}"}
        for suffix in ("a", "b")
    ]
    user_ids: list[str] = []
    try:
        with TestClient(app) as client:
            registrations = [client.post("/api/v1/auth/register", json=account) for account in accounts]
            assert all(response.status_code == 201 for response in registrations)
            user_ids.extend(response.json()["user"]["id"] for response in registrations)
            owner_token, other_token = (response.json()["accessToken"] for response in registrations)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}
            other_headers = {"Authorization": f"Bearer {other_token}"}

            payload = {
                "symbol": "VCB", "strategy": "buy_hold",
                "start": "2025-01-01", "end": "2025-02-01", "initialCapital": 100_000_000,
            }
            created = client.post("/api/v1/backtests", json=payload, headers=owner_headers)
            assert created.status_code == 200
            run = created.json()
            assert run["source"] == "csv-demo"
            assert "benchmark" in run

            listed = client.get("/api/v1/backtests", headers=owner_headers)
            assert run["id"] in [item["id"] for item in listed.json()["items"]]
            assert client.get(f"/api/v1/backtests/{run['id']}", headers=owner_headers).status_code == 200
            assert client.get(f"/api/v1/backtests/{run['id']}", headers=other_headers).status_code == 404
            assert client.get("/api/v1/backtests").status_code == 401
            assert client.post("/api/v1/backtests", json={**payload, "start": "2025-02-01"},
                               headers=owner_headers).status_code == 422
    finally:
        if user_ids:
            _delete_users(user_ids)
