"""Background market snapshot worker.

Run with: python worker.py
It refreshes before market open and periodically during the trading session so
the first user request reads a warm cache instead of waiting for every batch.
"""

import asyncio
import importlib.util
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import func, select

from core.config import settings
from db.models import MarketSnapshot, PriceBar
from db.session import AsyncSessionLocal
from jobs.ingest_prices import ingest_price_history
from jobs.ingest_news import ingest_news
from jobs.ingest_quotes import ingest_quote_board, quote_refresh_due
from jobs.ingest_symbols import ingest_symbols
from jobs.compute_event_studies import compute_news_event_studies
from jobs.sync_universe import quota_has_headroom, sync_universe_batch
from providers.factory import get_configured_market_source_id


VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def validate_provider_ready() -> None:
    """Fail at startup instead of leaving a real-data worker silently stale."""
    if settings.market_provider.lower() != "vnstock":
        return
    if not settings.vnstock_api_key:
        raise RuntimeError("VNSTOCK_API_KEY is required for the Vnstock worker")
    if importlib.util.find_spec("vnstock") is None:
        raise RuntimeError("Vnstock package is missing; build the worker with INSTALL_VNSTOCK=true")


async def _initial_sync() -> None:
    try:
        symbol_count = await ingest_symbols()
        print(f"Symbol directory synchronized: {symbol_count} rows", flush=True)
    except Exception as exc:
        print(f"Symbol directory synchronization failed: {exc}", flush=True)

    if settings.market_provider.lower() != "vnstock" or settings.vnstock_symbols.strip().upper() != "ALL":
        await _sync_history_if_empty()


async def _sync_history_if_empty() -> None:
    try:
        async with AsyncSessionLocal() as session:
            existing_bars = await session.scalar(select(func.count()).select_from(PriceBar).where(
                PriceBar.source == get_configured_market_source_id()
            )) or 0
        if existing_bars:
            return
        result = await ingest_price_history(date.today() - timedelta(days=730), date.today())
        label = "Synthetic demo" if settings.market_provider.lower() == "csv" else "Provider"
        print(f"{label} initial history sync complete: {result}", flush=True)
    except Exception as exc:
        # The worker may start before the web container applies Alembic migrations.
        print(f"Initial history sync is not ready and will retry: {exc}", flush=True)


async def _run_news_ingestion() -> None:
    try:
        result = await ingest_news()
        study_result = await compute_news_event_studies()
        print(f"[{datetime.now(VN_TZ).isoformat()}] news ingestion complete: {result}; event studies: {study_result}", flush=True)
    except Exception as exc:
        print(f"[{datetime.now(VN_TZ).isoformat()}] news ingestion failed: {exc}", flush=True)


async def _run_eod_ingestion() -> None:
    today = datetime.now(VN_TZ).date()
    try:
        # The full-universe job fetches equities in restartable batches. This
        # small EOD call advances the index date used as its refresh target.
        symbols = ["FPT"] if settings.market_provider.lower() == "vnstock" and settings.vnstock_symbols.strip().upper() == "ALL" else None
        result = await ingest_price_history(today - timedelta(days=3), today, symbols=symbols)
        study_result = await compute_news_event_studies()
        print(f"[{datetime.now(VN_TZ).isoformat()}] EOD ingestion complete: {result}; event studies: {study_result}", flush=True)
    except Exception as exc:
        print(f"[{datetime.now(VN_TZ).isoformat()}] EOD ingestion failed: {exc}", flush=True)


async def _run_universe_sync() -> None:
    try:
        result = await sync_universe_batch()
        if result["attempted"]:
            study_result = await compute_news_event_studies()
            print(f"[{datetime.now(VN_TZ).isoformat()}] Universe history batch: {result}; event studies: {study_result}", flush=True)
    except Exception as exc:
        print(f"[{datetime.now(VN_TZ).isoformat()}] Universe history batch failed: {exc}", flush=True)


async def _run_quote_board() -> None:
    try:
        import vnstock

        async with AsyncSessionLocal() as session:
            last_snapshot = await session.scalar(
                select(MarketSnapshot.as_of)
                .where(MarketSnapshot.payload["source"].as_string() == "vnstock")
                .order_by(MarketSnapshot.as_of.desc()).limit(1)
            )
        if not quote_refresh_due(datetime.now(VN_TZ), last_snapshot):
            return
        if not quota_has_headroom(vnstock.usage()):
            print("Quote board refresh paused for provider quota", flush=True)
            return
        result = await ingest_quote_board()
        print(f"[{datetime.now(VN_TZ).isoformat()}] Quote board refreshed: {result}", flush=True)
    except Exception as exc:
        print(f"[{datetime.now(VN_TZ).isoformat()}] Quote board refresh failed: {exc}", flush=True)


async def main() -> None:
    validate_provider_ready()
    await _initial_sync()
    scheduler = AsyncIOScheduler(timezone=VN_TZ)
    if settings.news_feed_enabled:
        scheduler.add_job(_run_news_ingestion, IntervalTrigger(minutes=15), id="news", max_instances=1,
                          coalesce=True, misfire_grace_time=300, next_run_time=datetime.now(VN_TZ))
    else:
        print("RSS news ingestion disabled; set NEWS_FEED_ENABLED=true after confirming feed-use rights.", flush=True)
    scheduler.add_job(_run_eod_ingestion, CronTrigger(day_of_week="mon-fri", hour=15, minute=40, timezone=VN_TZ),
                      id="daily-prices", max_instances=1, coalesce=True, misfire_grace_time=3600)
    scheduler.add_job(_initial_sync, IntervalTrigger(hours=1), id="initial-history-retry",
                      max_instances=1, coalesce=True, misfire_grace_time=3600)
    if settings.market_provider.lower() == "vnstock" and settings.vnstock_symbols.strip().upper() == "ALL":
        scheduler.add_job(_run_quote_board, IntervalTrigger(minutes=5), id="quote-board",
                          max_instances=1, coalesce=True, misfire_grace_time=300,
                          next_run_time=datetime.now(VN_TZ))
        scheduler.add_job(_run_universe_sync, IntervalTrigger(minutes=1), id="universe-history",
                          max_instances=1, coalesce=True, misfire_grace_time=300,
                          next_run_time=datetime.now(VN_TZ))
    scheduler.start()
    print("FinSight worker scheduled in Asia/Ho_Chi_Minh", flush=True)
    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown(wait=False)


if __name__ == "__main__":
    asyncio.run(main())
