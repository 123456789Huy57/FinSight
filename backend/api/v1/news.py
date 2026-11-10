from fastapi import APIRouter, Query
from sqlalchemy import func, select

from core.config import settings
from db.models import NewsArticle, NewsEventStudy, NewsSymbol, Symbol
from db.session import AsyncSessionLocal
from domain.text import normalize_vi

router = APIRouter(prefix="/api/v1/news", tags=["v1 news"])


def _impact_profile(article, symbols: list[str]) -> dict:
    text = normalize_vi(f"{article.title} {article.summary or ''}")
    profiles = (
        (
            ("dien mat troi", "gia phat dien", "dien mat"),
            "giá bán điện đầu ra",
            "Giá bán điện cao hơn có thể cải thiện doanh thu và biên lợi nhuận của nhà máy phát điện.",
            "Tích cực với doanh nghiệp phát điện liên quan; chưa kết luận nếu mã chỉ được gắn theo từ khoá.",
        ),
        (
            ("lai suat", "mat bang lai suat"),
            "chi phí vốn và biên lãi",
            "Lãi suất thay đổi tác động trực tiếp đến chi phí vay của doanh nghiệp và biên lãi của ngân hàng.",
            "Lãi suất giảm thường hỗ trợ nhóm vay nhiều và định giá cổ phiếu; chiều ngược lại gây áp lực.",
        ),
        (
            ("ty gia", "usd", "ngoai te"),
            "tỷ giá và doanh thu ngoại tệ",
            "Tỷ giá thay đổi làm đổi giá trị doanh thu xuất khẩu và chi phí nhập khẩu khi quy đổi sang đồng.",
            "Doanh nghiệp xuất khẩu và nhập khẩu có thể chịu tác động trái chiều.",
        ),
        (
            ("dau tho", "gia dau", "xang dau"),
            "giá nguyên liệu đầu vào",
            "Giá dầu thay đổi làm đổi chi phí nhiên liệu, vận tải và biên lợi nhuận của các ngành sử dụng dầu.",
            "Tác động tích cực hay tiêu cực phụ thuộc doanh nghiệp là bên bán hay bên sử dụng đầu vào.",
        ),
        (
            ("ket qua kinh doanh", "loi nhuan", "doanh thu", "co dong"),
            "doanh thu và lợi nhuận kỳ báo cáo",
            "Thông tin này thay đổi kỳ vọng về doanh thu, lợi nhuận và định giá của doanh nghiệp.",
            "Cần đối chiếu với số liệu kỳ trước và kỳ vọng thị trường trước khi kết luận chiều tác động.",
        ),
        (
            ("nvidia", "chip", "ban dan", "ai"),
            "nhu cầu chip và chi tiêu hạ tầng công nghệ",
            "Tin này chủ yếu tác động đến kỳ vọng ngành chip và chi tiêu hạ tầng công nghệ toàn cầu.",
            "Chưa thể suy ra tác động lên mã Việt Nam nếu bài viết chưa gắn với doanh nghiệp cụ thể.",
        ),
    )
    for terms, driver, mechanism, caveat in profiles:
        if any(term in text for term in terms):
            affected = (
                [{"symbol": symbol, "role": "mã được bài viết liên kết", "direction": "cần xác nhận"} for symbol in symbols]
                if symbols else []
            )
            return {
                "driver": driver,
                "mechanism": mechanism,
                "affected": affected,
                "caveat": caveat,
                "timeframe": "Giá có thể phản ứng trong T+1 đến T+5; tác động kết quả kinh doanh cần theo dõi kỳ báo cáo.",
            }

    category_profiles = {
        "economic": (
            "chính sách vĩ mô và chi phí vốn",
            "Tin có thể thay đổi chi phí vốn, sức mua hoặc tỷ giá, từ đó ảnh hưởng khác nhau theo ngành.",
        ),
        "regulatory": (
            "chi phí tuân thủ và quyền kinh doanh",
            "Quy định mới có thể làm đổi chi phí tuân thủ, sản lượng được phép hoặc thời gian cấp phép.",
        ),
        "stock": (
            "kỳ vọng doanh thu và lợi nhuận",
            "Thông tin doanh nghiệp thường được thị trường phản ánh qua kỳ vọng doanh thu, lợi nhuận và dòng tiền.",
        ),
        "market": (
            "tâm lý và dòng tiền thị trường",
            "Tin chỉ tạo tác động trực tiếp khi có kênh truyền dẫn rõ; nếu không, phản ứng thường thể hiện qua tâm lý và dòng tiền.",
        ),
    }
    driver, mechanism = category_profiles.get(article.category or "market", category_profiles["market"])
    return {
        "driver": driver,
        "mechanism": mechanism,
        "affected": [{"symbol": symbol, "role": "mã được bài viết liên kết", "direction": "cần xác nhận"} for symbol in symbols],
        "caveat": "Chưa có đủ chi tiết để kết luận mã này hưởng lợi hay chịu áp lực.",
        "timeframe": "Theo dõi phản ứng giá T+1 đến T+5 và thông tin xác nhận tiếp theo.",
    }


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
        symbol_rows = []
        event_rows = []
        if articles:
            links = (await session.execute(
                select(NewsSymbol.article_id, NewsSymbol.symbol)
                .where(NewsSymbol.article_id.in_([article.id for article in articles]))
            )).all()
            for article_id, ticker in links:
                related.setdefault(article_id, []).append(ticker)
            symbol_rows = list((await session.execute(
                select(Symbol.symbol, Symbol.name, Symbol.sector).where(
                    Symbol.symbol.in_({ticker for _, ticker in links})
                )
            )).all())
            event_rows = list((await session.scalars(
                select(NewsEventStudy).where(
                    NewsEventStudy.article_id.in_([article.id for article in articles])
                )
            )).all())

    events_by_article = {}
    for event in event_rows:
        events_by_article.setdefault(event.article_id, {})[event.symbol] = event
    symbol_context = {
        symbol: {"name": name, "sector": sector}
        for symbol, name, sector in symbol_rows
    }

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

    def impact_explanation(article, reactions):
        symbols = sorted(related.get(article.id, []))
        profile = _impact_profile(article, symbols)
        affected = profile["affected"]
        if affected:
            names = ", ".join(
                f'{item["symbol"]} ({symbol_context.get(item["symbol"], {}).get("sector") or "chưa rõ ngành"})'
                for item in affected
            )
            possible = f'{profile["mechanism"]} Mã cần theo dõi: {names}.'
        else:
            possible = f'{profile["mechanism"]} Chưa xác định được mã Việt Nam chịu tác động trực tiếp.'
        measured = [reaction for reaction in reactions if reaction["status"] == "measured"]
        if measured:
            observed = "Đã đo được biến động sau tin; đây là tương quan quan sát, không khẳng định tin gây ra biến động."
            confidence = "measured"
        elif reactions:
            observed = "Chưa đủ dữ liệu để đo phản ứng T+1/T+5 của các mã liên quan."
            confidence = "insufficient_data"
        else:
            observed = "Chưa xác định được mã cổ phiếu liên quan để đo phản ứng giá."
            confidence = "insufficient_data"
        return possible, observed, confidence, profile

    def forecast_for(article, related):
        profile = _impact_profile(article, sorted(related))
        direction = {
            "positive": "Tích cực nhẹ",
            "negative": "Tiêu cực nhẹ",
        }.get(article.sentiment, "Giằng co")
        confidence = 55 if related else 35
        if article.category in {"economic", "regulatory"}:
            confidence += 5
        return {
            "direction": direction,
            "horizon": "T+1 đến T+5",
            "confidence": min(confidence, 65),
            "basis": (
                f'Biến số chính: {profile["driver"]}. {profile["caveat"]} '
                "Đây là kịch bản tham khảo, chưa phải phản ứng giá đã quan sát."
            ),
            "driver": profile["driver"],
            "timeframe": profile["timeframe"],
        }

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
            **(lambda reactions: dict(zip(
                ("possibleImpact", "observedImpact", "impactConfidence", "impactDetail"),
                impact_explanation(article, reactions),
            )))(reactions_for(article.id)),
            "forecast": forecast_for(article, related.get(article.id, [])),
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
