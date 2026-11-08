import asyncio
import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.models import Symbol
from db.session import AsyncSessionLocal, engine
from main import app


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def db_session():
    """A database session whose commits remain inside a rolled-back test transaction."""
    await engine.dispose()
    async with engine.connect() as connection:
        transaction = await connection.begin()
        try:
            async with AsyncSession(
                bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
            ) as session:
                yield session
        finally:
            await transaction.rollback()
    await engine.dispose()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "run_snapshot_jobs", False)
    with TestClient(app, client=(f"finsight-test-{uuid.uuid4().hex}", 50000)) as test_client:
        yield test_client


@pytest.fixture
def seed_symbols():
    """Seed committed symbols visible to TestClient, then remove only rows we inserted."""
    inserted: set[str] = set()

    def seed(*symbols: Symbol) -> None:
        async def insert_rows() -> None:
            await engine.dispose()
            async with AsyncSessionLocal.begin() as session:
                for symbol in symbols:
                    if not await session.get(Symbol, symbol.symbol):
                        session.add(symbol)
                        inserted.add(symbol.symbol)
            await engine.dispose()

        asyncio.run(insert_rows())

    yield seed

    if inserted:
        async def delete_rows() -> None:
            await engine.dispose()
            async with AsyncSessionLocal.begin() as session:
                await session.execute(delete(Symbol).where(Symbol.symbol.in_(inserted)))
            await engine.dispose()

        asyncio.run(delete_rows())


@pytest.fixture
def load_fixture():
    root = Path(__file__).parent / "fixtures"

    def load(name: str):
        path = (root / name).resolve()
        if not path.is_relative_to(root.resolve()):
            raise ValueError("Fixture path must stay inside tests/fixtures")
        with path.open(encoding="utf-8") as source:
            return json.load(source)

    return load
