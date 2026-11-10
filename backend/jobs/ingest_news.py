import asyncio
import logging
import uuid
from datetime import datetime

from sqlalchemy import delete, select

from core.config import settings
from db.models import NewsArticle, NewsEventStudy, NewsSymbol, Symbol
from db.session import AsyncSessionLocal
from domain.sentiment import score_sentiment
from domain.text import normalize_vi
from domain.ticker_linking import related_symbols
from services.news_service import canonicalize_url, fetch_news_items, normalize_published_at, story_hash

logger = logging.getLogger(__name__)

CATEGORY_RULES = {
    "regulatory": ("chính phủ", "ngân hàng nhà nước", "bộ tài chính", "quy định", "pháp lý"),
    "economic": ("lạm phát", "gdp", "lãi suất", "tỷ giá", "kinh tế", "xuất khẩu"),
    "stock": ("cổ phiếu", "doanh nghiệp", "công ty", "kết quả kinh doanh", "cổ đông"),
}

def _category(text: str) -> str:
    normalized = normalize_vi(text)
    for category, terms in CATEGORY_RULES.items():
        if any(normalize_vi(term) in normalized for term in terms):
            return category
    return "market"


def _related_symbols(text: str, symbols: list[tuple[str, str | None]]) -> list[str]:
    return related_symbols(text, symbols)


async def ingest_news(limit: int = 50) -> dict[str, int]:
    if not settings.news_feed_enabled:
        logger.info("RSS news ingestion skipped because NEWS_FEED_ENABLED is false")
        return {"enabled": 0, "fetched": 0, "inserted": 0, "tickerLinks": 0}

    articles = await asyncio.to_thread(fetch_news_items, limit)
    async with AsyncSessionLocal() as session:
        listed = list((await session.execute(select(Symbol.symbol, Symbol.name).where(Symbol.is_active.is_(True)))).all())
        symbol_pairs = [(symbol, name) for symbol, name in listed]
        valid_symbols = {symbol for symbol, _ in listed}
        inserted = 0
        linked = 0
        for item in articles:
            title = (item.get("headline") or "").strip()
            if not title:
                continue
            summary = item.get("summary") or ""
            raw_published_at = item.get("published_at")
            published_iso = normalize_published_at(raw_published_at)
            published_at = datetime.fromisoformat(published_iso) if published_iso else None
            raw_hash = story_hash(title, published_iso)
            url = canonicalize_url(item.get("url")) or f"urn:finsight:sha256:{raw_hash}"
            existing_id = await session.scalar(select(NewsArticle.id).where(
                (NewsArticle.url == url) | (NewsArticle.raw_hash == raw_hash)
            ).limit(1))
            if existing_id:
                article_id = existing_id
            else:
                score, sentiment = score_sentiment(f"{title} {summary}")
                article_id = str(uuid.uuid4())
                session.add(NewsArticle(
                    id=article_id, url=url, source=item.get("source") or "Unknown",
                    title=title[:1000], summary=summary,
                    search_text=normalize_vi(f"{title} {summary} {item.get('source') or ''}"),
                    published_at=published_at,
                    category=_category(f"{title} {summary}"),
                    sentiment=sentiment, sentiment_score=score, raw_hash=raw_hash,
                ))
                inserted += 1
            tickers = set(_related_symbols(f"{title} {summary}", symbol_pairs)) & valid_symbols
            existing_links = set((await session.scalars(
                select(NewsSymbol.symbol).where(NewsSymbol.article_id == article_id)
            )).all())
            stale_links = existing_links - tickers
            if stale_links:
                await session.execute(delete(NewsSymbol).where(
                    NewsSymbol.article_id == article_id,
                    NewsSymbol.symbol.in_(stale_links),
                ))
                await session.execute(delete(NewsEventStudy).where(
                    NewsEventStudy.article_id == article_id,
                    NewsEventStudy.symbol.in_(stale_links),
                ))
            for ticker in tickers - existing_links:
                session.add(NewsSymbol(article_id=article_id, symbol=ticker))
                linked += 1
        await session.commit()
    return {"fetched": len(articles), "inserted": inserted, "tickerLinks": linked}
