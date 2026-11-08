"""Run one bounded market-data refresh for a scheduled CI job."""

import asyncio
from datetime import datetime

from core.config import settings
from jobs.compute_event_studies import compute_news_event_studies
from jobs.ingest_news import ingest_news
from jobs.ingest_quotes import ingest_quote_board
from jobs.ingest_symbols import ingest_symbols
from jobs.sync_universe import sync_universe_batch
from worker import validate_provider_ready


async def run() -> None:
    validate_provider_ready()
    if settings.market_provider.lower() != "vnstock":
        raise RuntimeError("The daily real-data sync requires MARKET_PROVIDER=vnstock")

    symbols = await ingest_symbols()
    print(f"Symbol directory synchronized: {symbols}", flush=True)

    quote_result = await ingest_quote_board()
    print(f"Quote board refreshed: {quote_result}", flush=True)

    if settings.news_feed_enabled:
        news_result = await ingest_news()
        print(f"News ingestion complete: {news_result}", flush=True)

    history_result = await sync_universe_batch(batch_size=50)
    print(f"History batch complete: {history_result}", flush=True)

    study_result = await compute_news_event_studies()
    print(f"Event studies complete: {study_result}", flush=True)
    print(f"Daily sync finished at {datetime.now().isoformat()}", flush=True)


if __name__ == "__main__":
    asyncio.run(run())
