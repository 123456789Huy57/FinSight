import asyncio

from sqlalchemy.dialects.postgresql import insert

from db.models import Symbol
from db.session import AsyncSessionLocal
from domain.text import normalize_vi
from providers.factory import get_market_provider


async def ingest_symbols() -> int:
    provider = get_market_provider()
    frame = await asyncio.to_thread(provider.list_symbols)
    if frame is None or frame.empty or "symbol" not in frame.columns:
        raise RuntimeError("Market provider returned no usable symbol list")
    records = []
    for row in frame.to_dict(orient="records"):
        code = str(row.get("symbol") or "").strip().upper()
        if not code:
            continue
        records.append({
            "symbol": code,
            "name": row.get("name") or row.get("organ_name"),
            "search_text": normalize_vi(" ".join(str(value) for value in
                                                    (code, row.get("name") or row.get("organ_name"), row.get("sector"))
                                                    if value)),
            "exchange": row.get("exchange"),
            "sector": row.get("sector"),
            "is_active": True,
        })
    statement = insert(Symbol).values(records)
    async with AsyncSessionLocal.begin() as session:
        await session.execute(statement.on_conflict_do_update(
            index_elements=[Symbol.symbol],
            set_={
                "name": statement.excluded.name,
                "search_text": statement.excluded.search_text,
                "exchange": statement.excluded.exchange,
                "sector": statement.excluded.sector,
                "is_active": True,
            },
        ))
    return len(records)
