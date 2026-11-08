import uuid
import asyncio
from datetime import date

from fastapi.testclient import TestClient

from core.config import settings
from db.models import PriceBar, Symbol, User
from db.session import AsyncSessionLocal, engine
from main import app
from providers.factory import get_configured_market_source_id
from sqlalchemy import delete


def _delete_users(ids: list[str]) -> None:
    async def delete_rows() -> None:
        await engine.dispose()
        async with AsyncSessionLocal.begin() as session:
            await session.execute(delete(User).where(User.id.in_(ids)))
        await engine.dispose()

    asyncio.run(delete_rows())


def _seed_backtest_history(symbol: str, source: str) -> None:
    async def insert_rows() -> None:
        await engine.dispose()
        async with AsyncSessionLocal.begin() as session:
            session.add(Symbol(symbol=symbol, name="Backtest fixture", exchange="HOSE", is_active=True))
            await session.flush()
            session.add_all([
                PriceBar(symbol=symbol, source=source, trade_date=date(2020, 1, day),
                         open=100 + day, high=102 + day, low=99 + day, close=101 + day)
                for day in (2, 3, 6)
            ])
        await engine.dispose()

    asyncio.run(insert_rows())


def _delete_backtest_history(symbol: str) -> None:
    async def delete_rows() -> None:
        await engine.dispose()
        async with AsyncSessionLocal.begin() as session:
            await session.execute(delete(Symbol).where(Symbol.symbol == symbol))
        await engine.dispose()

    asyncio.run(delete_rows())


def test_backtest_result_is_persisted_and_private_to_owner(monkeypatch):
    monkeypatch.setattr(settings, "run_snapshot_jobs", False)
    email_root = f"backtest-{uuid.uuid4().hex}"
    accounts = [
        {"email": f"{email_root}-{suffix}@example.test", "password": f"correct-horse-battery-{suffix}"}
        for suffix in ("a", "b")
    ]
    user_ids: list[str] = []
    test_symbol = f"TST{uuid.uuid4().hex[:8]}".upper()
    _seed_backtest_history(test_symbol, get_configured_market_source_id())
    try:
        with TestClient(app, client=(f"finsight-backtest-{uuid.uuid4().hex}", 50000)) as client:
            registrations = [client.post("/api/v1/auth/register", json=account) for account in accounts]
            assert all(response.status_code == 201 for response in registrations)
            user_ids.extend(response.json()["user"]["id"] for response in registrations)
            owner_token, other_token = (response.json()["accessToken"] for response in registrations)
            owner_headers = {"Authorization": f"Bearer {owner_token}"}
            other_headers = {"Authorization": f"Bearer {other_token}"}

            payload = {
                "symbol": test_symbol, "strategy": "buy_hold",
                "start": "2020-01-01", "end": "2020-02-01", "initialCapital": 100_000_000,
            }
            created = client.post("/api/v1/backtests", json=payload, headers=owner_headers)
            assert created.status_code == 200
            run = created.json()
            assert run["source"] == get_configured_market_source_id()
            assert "benchmark" in run

            listed = client.get("/api/v1/backtests", headers=owner_headers)
            assert run["id"] in [item["id"] for item in listed.json()["items"]]
            assert client.get(f"/api/v1/backtests/{run['id']}", headers=owner_headers).status_code == 200
            assert client.get(f"/api/v1/backtests/{run['id']}", headers=other_headers).status_code == 404
            assert client.get("/api/v1/backtests").status_code == 401
            assert client.post("/api/v1/backtests", json={**payload, "start": "2020-02-01"},
                               headers=owner_headers).status_code == 422
    finally:
        if user_ids:
            _delete_users(user_ids)
        _delete_backtest_history(test_symbol)
