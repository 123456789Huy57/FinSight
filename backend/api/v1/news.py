from fastapi import APIRouter, Query
from sqlalchemy import func, select

from core.config import settings
from db.models import NewsArticle, NewsEventStudy, NewsSymbol
from db.session import AsyncSessionLocal
from domain.text import normalize_vi

router = APIRouter(prefix="/api/v1/news", tags=["v1 news"])


@router.get("")
async def list_news(
    q: str | None = None,
    category: str | None = None,
    sentiment: str | None = Query(None, pattern="^(positive|neutral|negative)$"),
    symbol: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if not settings.news_feed_enabled:
        return {"items": [], "total": 0, "limit": limit, "offset": offset,
                "source": None, "dataMode": None, "asOf": None, "status": "disabled"}

    stmt = select(NewsArticle)
    if symbol:
        stmt = stmt.join(NewsSymbol, NewsSymbol.article_id == NewsArticle.id).where(NewsSymbol.symbol == symbol.upper())
    if q:
        stmt = stmt.where(NewsArticle.search_text.ilike(f"%{normalize_vi(q.strip())}%"))
    if category:
        stmt = stmt.where(NewsArticle.category == category)
    if sentiment:
        stmt = stmt.where(NewsArticle.sentiment == sentiment)
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    stmt = stmt.order_by(NewsArticle.published_at.desc().nullslast(), NewsArticle.created_at.desc()).limit(limit).offset(offset)

    async with AsyncSessionLocal() as session:
        total = await session.scalar(count_stmt) or 0
        articles = list((await session.scalars(stmt)).all())
        related = {}
        event_rows = []
        if articles:
            links = (await session.execute(
                select(NewsSymbol.article_id, NewsSymbol.symbol)
                .where(NewsSymbol.article_id.in_([article.id for article in articles]))
            )).all()
            for article_id, ticker in links:
                related.setdefault(article_id, []).append(ticker)
            event_rows = list((await session.scalars(
                select(NewsEventStudy).where(
                    NewsEventStudy.article_id.in_([article.id for article in articles])
                )
            )).all())

    events_by_article = {}
    for event in event_rows:
        events_by_article.setdefault(event.article_id, {})[event.symbol] = event

    def window_payload(event, horizon: str):
        return {
            "status": getattr(event, f"{horizon}_status"),
            "endDate": getattr(event, f"{horizon}_end_date").isoformat()
            if getattr(event, f"{horizon}_end_date") else None,
            "returnPct": float(getattr(event, f"{horizon}_return_pct"))
            if getattr(event, f"{horizon}_return_pct") is not None else None,
            "benchmarkReturnPct": float(getattr(event, f"{horizon}_benchmark_return_pct"))
            if getattr(event, f"{horizon}_benchmark_return_pct") is not None else None,
            "abnormalReturnPct": float(getattr(event, f"{horizon}_abnormal_return_pct"))
            if getattr(event, f"{horizon}_abnormal_return_pct") is not None else None,
            "reason": getattr(event, f"{horizon}_reason"),
        }

    def reactions_for(article_id):
        reactions = []
        for ticker in sorted(related.get(article_id, [])):
            event = events_by_article.get(article_id, {}).get(ticker)
            if event is None:
                t1 = {"status": "pending", "endDate": None, "returnPct": None,
                      "benchmarkReturnPct": None, "abnormalReturnPct": None, "reason": "awaiting_calculation"}
                t5 = {**t1}
                reactions.append({"symbol": ticker, "status": "pending", "methodVersion": None,
                                  "benchmarkSymbol": "VNINDEX", "dataMode": None, "priceSource": None,
                                  "benchmarkSource": None, "asOf": None, "t1": t1, "t5": t5})
                continue
            t1 = window_payload(event, "t1")
            t5 = window_payload(event, "t5")
            statuses = {t1["status"], t5["status"]}
            overall = (
                "overlapping_event" if "overlapping_event" in statuses else
                "measured" if statuses == {"measured"} else
                "pending" if "pending" in statuses else
                "insufficient_data"
            )
            reactions.append({
                "symbol": ticker,
                "status": overall,
                "methodVersion": event.method_version,
                "benchmarkSymbol": event.benchmark_symbol,
                "dataMode": event.data_mode,
                "priceSource": event.price_source,
                "benchmarkSource": event.benchmark_source,
                "eventTradeDate": event.event_trade_date.isoformat() if event.event_trade_date else None,
                "asOf": event.calculated_at.isoformat(),
                "t1": t1,
                "t5": t5,
            })
        return reactions

    return {
        "items": [{
            "id": article.id,
            "headline": article.title,
            "summary": article.summary,
            "source": article.source,
            "timestamp": article.published_at.isoformat() if article.published_at else article.created_at.isoformat(),
            "sentiment": article.sentiment,
            "category": article.category,
            "sentimentScore": float(article.sentiment_score),
            "sentimentMethod": "keyword-baseline",
            "relatedSymbols": sorted(related.get(article.id, [])),
            "reactions": reactions_for(article.id),
            "url": article.url,
        } for article in articles],
        "total": total,
        "limit": limit,
        "offset": offset,
        "source": "rss",
        "dataMode": "external-feed",
        "asOf": (articles[0].published_at.isoformat() if articles and articles[0].published_at
                 else articles[0].created_at.isoformat() if articles else None),
        "status": "available" if articles else "no_data",
    }
