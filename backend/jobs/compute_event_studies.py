"""Persist versioned T+1/T+5 event-study observations for linked news."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from core.config import settings
from db.models import IndexBar, NewsArticle, NewsEventStudy, NewsSymbol, PriceBar
from db.session import AsyncSessionLocal
from domain.event_study import BENCHMARK_SYMBOL, calculate_event_study, event_trade_date_for_published_at
from providers.factory import get_configured_market_source_id

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
STUDY_FIELDS = (
    "article_id", "symbol", "method_version", "benchmark_symbol", "data_mode", "price_source",
    "benchmark_source", "event_trade_date", "event_adjusted_close", "benchmark_event_close",
    "t1_status", "t1_end_date", "t1_adjusted_close", "t1_benchmark_close", "t1_return_pct",
    "t1_benchmark_return_pct", "t1_abnormal_return_pct", "t1_reason", "t5_status", "t5_end_date",
    "t5_adjusted_close", "t5_benchmark_close", "t5_return_pct", "t5_benchmark_return_pct",
    "t5_abnormal_return_pct", "t5_reason", "calculated_at",
)


async def compute_news_event_studies(limit: int = 2000) -> dict[str, int | str]:
    if not settings.news_feed_enabled:
        return {"status": "disabled", "events": 0, "measured": 0}

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=365)
    source = get_configured_market_source_id()
    async with AsyncSessionLocal() as session:
        linked_articles = list((await session.execute(
            select(NewsArticle, NewsSymbol.symbol)
            .join(NewsSymbol, NewsSymbol.article_id == NewsArticle.id)
            .where(NewsArticle.published_at >= cutoff)
            .order_by(NewsArticle.published_at.asc(), NewsArticle.id.asc(), NewsSymbol.symbol.asc())
            .limit(max(1, min(limit, 5000)))
        )).all())
        if not linked_articles:
            return {"status": "no_data", "events": 0, "measured": 0}

        symbols = {symbol for _, symbol in linked_articles}
        earliest_day = min(article.published_at.astimezone(VN_TZ).date() for article, _ in linked_articles)
        price_rows = list((await session.scalars(
            select(PriceBar).where(
                PriceBar.symbol.in_(symbols),
                PriceBar.source == source,
                PriceBar.trade_date >= earliest_day - timedelta(days=10),
            ).order_by(PriceBar.symbol, PriceBar.trade_date)
        )).all())
        benchmark_rows = list((await session.scalars(
            select(IndexBar).where(
                IndexBar.index_symbol == BENCHMARK_SYMBOL,
                IndexBar.source == source,
                IndexBar.trade_date >= earliest_day - timedelta(days=10),
            ).order_by(IndexBar.trade_date)
        )).all())

    stock_bars_by_symbol: dict[str, list[PriceBar]] = {}
    for bar in price_rows:
        stock_bars_by_symbol.setdefault(bar.symbol, []).append(bar)
    event_dates_by_symbol: dict[str, list[tuple[str, date]]] = {}
    for article, symbol in linked_articles:
        bars = stock_bars_by_symbol.get(symbol, [])
        event_date = event_trade_date_for_published_at(article.published_at, bars)
        if event_date is not None:
            event_dates_by_symbol.setdefault(symbol, []).append((article.id, event_date))

    data_mode = "synthetic-demo" if source == "csv-demo" else "market-provider"
    rows = []
    for article, symbol in linked_articles:
        stock_bars = stock_bars_by_symbol.get(symbol, [])
        event_dates = {
            event_date for article_id, event_date in event_dates_by_symbol.get(symbol, [])
            if article_id != article.id
        }
        calculated = calculate_event_study(
            article_id=article.id,
            symbol=symbol,
            published_at=article.published_at,
            stock_bars=stock_bars,
            benchmark_bars=benchmark_rows,
            data_mode=data_mode,
            price_source=source,
            benchmark_source=source if benchmark_rows else None,
            other_event_dates=event_dates,
            calculated_at=now,
        )
        rows.append({key: calculated[key] for key in STUDY_FIELDS})

    async with AsyncSessionLocal.begin() as session:
        statement = insert(NewsEventStudy).values(rows)
        update_fields = [field for field in STUDY_FIELDS if field not in {"article_id", "symbol", "method_version"}]
        await session.execute(statement.on_conflict_do_update(
            index_elements=[NewsEventStudy.article_id, NewsEventStudy.symbol, NewsEventStudy.method_version],
            set_={field: getattr(statement.excluded, field) for field in update_fields},
        ))

    measured = sum(row["t1_status"] == "measured" or row["t5_status"] == "measured" for row in rows)
    return {"status": "success", "events": len(rows), "measured": measured, "source": source, "dataMode": data_mode}
