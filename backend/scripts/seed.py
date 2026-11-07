import asyncio

from sqlalchemy.dialects.postgresql import insert

from db.models import Symbol
from db.session import AsyncSessionLocal
from domain.text import normalize_vi
from providers.factory import get_market_provider


async def main() -> None:
    frame = get_market_provider().list_symbols()
    if frame.empty:
        raise RuntimeError("Selected provider returned an empty symbol list")
    records = []
    for row in frame.to_dict(orient="records"):
        symbol = str(row.get("symbol", "")).strip().upper()
        if not symbol:
            continue
        records.append({
            "symbol": symbol,
            "name": row.get("name") or row.get("organ_name"),
            "search_text": normalize_vi(" ".join(str(value) for value in
                                                    (symbol, row.get("name") or row.get("organ_name"), row.get("sector"))
                                                    if value)),
            "exchange": row.get("exchange"),
            "sector": row.get("sector"),
            "is_active": True,
        })
    statement = insert(Symbol).values(records)
    async with AsyncSessionLocal.begin() as session:
        await session.execute(
            statement
            .on_conflict_do_update(
                index_elements=[Symbol.symbol],
                set_={
                    "name": statement.excluded.name,
                    "search_text": statement.excluded.search_text,
                    "exchange": statement.excluded.exchange,
                    "sector": statement.excluded.sector,
                    "is_active": True,
                },
            )
        )
    print(f"Upserted {len(records)} symbols")


if __name__ == "__main__":
    asyncio.run(main())
