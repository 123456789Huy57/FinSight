import asyncio
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete

from db.models import Symbol, User
from db.session import AsyncSessionLocal, engine
from main import app


def _insert_symbol():
    async def insert():
        await engine.dispose()
        async with AsyncSessionLocal.begin() as session:
            if not await session.get(Symbol, "VCB"):
                session.add(Symbol(symbol="VCB", name="Fixture Bank", exchange="HOSE", sector="Banking"))
        await engine.dispose()

    asyncio.run(insert())


def _delete_users(ids: list[str]):
    async def delete_users():
        await engine.dispose()
        async with AsyncSessionLocal.begin() as session:
            await session.execute(delete(User).where(User.id.in_(ids)))
        await engine.dispose()

    asyncio.run(delete_users())


def test_duplicate_email_is_conflict_and_accounts_are_isolated():
    email_root = f"integration-{uuid.uuid4().hex}"
    credentials_a = {"email": f"{email_root}-a@example.test", "password": "correct-horse-battery-1"}
    credentials_b = {"email": f"{email_root}-b@example.test", "password": "correct-horse-battery-2"}
    user_ids = []
    _insert_symbol()
    try:
        with TestClient(app) as client:
            response_a = client.post("/api/v1/auth/register", json=credentials_a)
            response_b = client.post("/api/v1/auth/register", json=credentials_b)
            assert response_a.status_code == 201
            assert response_b.status_code == 201
            user_ids.extend([response_a.json()["user"]["id"], response_b.json()["user"]["id"]])
            assert client.post("/api/v1/auth/register", json=credentials_a).status_code == 409

            token_a = response_a.json()["accessToken"]
            token_b = response_b.json()["accessToken"]
            auth_a = {"Authorization": f"Bearer {token_a}"}
            auth_b = {"Authorization": f"Bearer {token_b}"}
            assert client.post("/api/v1/watchlist", json={"symbol": "VCB"}, headers=auth_a).status_code == 201
            own = client.get("/api/v1/watchlist", headers=auth_a)
            other = client.get("/api/v1/watchlist", headers=auth_b)
            assert [row["symbol"] for row in own.json()["items"]] == ["VCB"]
            assert other.json()["items"] == []

            assert client.post("/api/v1/portfolio/trades", json={
                "symbol": "VCB", "side": "BUY", "quantity": 100, "price": 50000,
            }, headers=auth_a).status_code == 201
            rejected = client.post("/api/v1/portfolio/trades", json={
                "symbol": "VCB", "side": "SELL", "quantity": 200, "price": 51000,
            }, headers=auth_a)
            assert rejected.status_code == 409
    finally:
        if user_ids:
            _delete_users(user_ids)
