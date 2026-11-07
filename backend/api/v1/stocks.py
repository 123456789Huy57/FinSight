from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import pandas as pd
from sqlalchemy import and_, func, select

from db.models import Fundamental, PriceBar, Symbol
from db.session import AsyncSessionLocal
from domain.indicators import bollinger, ema, macd, rsi, sma
from domain.signals import classify_indicator, summarize_signals
from domain.text import normalize_vi
from providers.factory import get_configured_market_source_id

router = APIRouter(prefix="/api/v1", tags=["v1 stocks"])


@router.get("/search")
async def search_stocks(
    q: str = Query(min_length=1, max_length=40),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    term = f"%{normalize_vi(q.strip())}%"
    stmt = select(Symbol).where(
        Symbol.is_active.is_(True),
        Symbol.search_text.ilike(term),
    ).order_by(Symbol.symbol).limit(limit).offset(offset)
    async with AsyncSessionLocal() as session:
        rows = list((await session.scalars(stmt)).all())
    return {"items": [{"symbol": row.symbol, "name": row.name, "exchange": row.exchange} for row in rows],
            "limit": limit, "offset": offset}


@router.get("/stocks")
async def list_stocks(
    q: str | None = None,
    exchange: str | None = None,
    sector: str | None = None,
    sort: str = Query("gainers", pattern="^(gainers|losers|volume|symbol|marketCap|tradingValue)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    source = get_configured_market_source_id()
    latest_dates = select(PriceBar.symbol, func.max(PriceBar.trade_date).label("trade_date")).where(
        PriceBar.source == source
    ).group_by(PriceBar.symbol).subquery()
    previous_dates = (
        select(PriceBar.symbol, func.max(PriceBar.trade_date).label("trade_date"))
        .join(latest_dates, latest_dates.c.symbol == PriceBar.symbol)
        .where(PriceBar.trade_date < latest_dates.c.trade_date, PriceBar.source == source)
        .group_by(PriceBar.symbol)
        .subquery()
    )
    previous_bar = PriceBar.__table__.alias("previous_bar")
    latest_fundamental_id = (
        select(Fundamental.id).where(Fundamental.symbol == Symbol.symbol)
        .order_by(Fundamental.as_of.desc(), Fundamental.id.desc()).limit(1)
        .correlate(Symbol).scalar_subquery()
    )
    stmt = (
        select(Symbol, PriceBar, previous_bar.c.close.label("previous_close"), Fundamental)
        .outerjoin(latest_dates, latest_dates.c.symbol == Symbol.symbol)
        .outerjoin(PriceBar, (PriceBar.symbol == Symbol.symbol) & (PriceBar.trade_date == latest_dates.c.trade_date)
                   & (PriceBar.source == source))
        .outerjoin(previous_dates, previous_dates.c.symbol == Symbol.symbol)
        .outerjoin(previous_bar, and_(previous_bar.c.symbol == Symbol.symbol, previous_bar.c.trade_date == previous_dates.c.trade_date,
                                      previous_bar.c.source == source))
        .outerjoin(Fundamental, Fundamental.id == latest_fundamental_id)
        .where(Symbol.is_active.is_(True), latest_dates.c.trade_date.is_not(None))
    )
    if q:
        term = f"%{normalize_vi(q.strip())}%"
        stmt = stmt.where(Symbol.search_text.ilike(term))
    if exchange:
        stmt = stmt.where(Symbol.exchange == exchange.upper())
    if sector:
        stmt = stmt.where(Symbol.sector == sector)

    async with AsyncSessionLocal() as session:
        total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        if sort == "gainers":
            stmt = stmt.order_by(((PriceBar.close - previous_bar.c.close) / func.nullif(previous_bar.c.close, 0)).desc().nullslast())
        elif sort == "losers":
            stmt = stmt.order_by(((PriceBar.close - previous_bar.c.close) / func.nullif(previous_bar.c.close, 0)).asc().nullslast())
        elif sort == "volume":
            stmt = stmt.order_by(PriceBar.volume.desc().nullslast())
        elif sort == "marketCap":
            stmt = stmt.order_by(Fundamental.market_cap.desc().nullslast())
        elif sort == "tradingValue":
            stmt = stmt.order_by((PriceBar.close * PriceBar.volume).desc().nullslast())
        else:
            stmt = stmt.order_by(Symbol.symbol.asc())
        rows = (await session.execute(stmt.limit(limit).offset(offset))).all()

    items = []
    for symbol, bar, previous_close, fundamental in rows:
        change = float(bar.close - previous_close) if bar and previous_close is not None else None
        percent_change = (change / float(previous_close) * 100) if change is not None and previous_close else None
        items.append({
            "symbol": symbol.symbol,
            "name": symbol.name,
            "price": float(bar.close) if bar and bar.close is not None else None,
            "change": change,
            "percentChange": percent_change,
            "volume": bar.volume if bar else None,
            "tradingValue": float(bar.close) * bar.volume if bar and bar.volume is not None else None,
            "marketCap": float(fundamental.market_cap) if fundamental and fundamental.market_cap is not None else None,
            "pe": float(fundamental.pe) if fundamental and fundamental.pe is not None else None,
            "pb": float(fundamental.pb) if fundamental and fundamental.pb is not None else None,
            "eps": float(fundamental.eps) if fundamental and fundamental.eps is not None else None,
            "dividendYield": float(fundamental.dividend_yield) if fundamental and fundamental.dividend_yield is not None else None,
            "fundamentalAsOf": fundamental.as_of.isoformat() if fundamental else None,
            "fundamentalSource": fundamental.source if fundamental else None,
            "exchange": symbol.exchange,
            "sector": symbol.sector,
            "asOf": bar.trade_date.isoformat() if bar else None,
            "source": bar.source if bar else None,
            "dataMode": "synthetic-demo" if bar and bar.source == "csv-demo" else "market-provider",
        })
    source = get_configured_market_source_id()
    data_mode = "synthetic-demo" if source == "csv-demo" else "market-provider"
    return {"items": items, "total": total, "limit": limit, "offset": offset, "dataMode": data_mode,
            "source": source,
            "asOf": max((item["asOf"] for item in items if item["asOf"]), default=None)}


@router.get("/stocks/{symbol}")
async def stock_detail(symbol: str):
    code = symbol.upper()
    async with AsyncSessionLocal() as session:
        profile = await session.get(Symbol, code)
        if profile is None or not profile.is_active:
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "SYMBOL_NOT_FOUND", "message": f"Unknown symbol: {code}"}},
            )
        bars = list((await session.scalars(
            select(PriceBar).where(PriceBar.symbol == code, PriceBar.source == get_configured_market_source_id())
            .order_by(PriceBar.trade_date.desc()).limit(252)
        )).all())
        fundamental = await session.scalar(
            select(Fundamental).where(Fundamental.symbol == code).order_by(Fundamental.as_of.desc()).limit(1)
        )
    latest = bars[0] if bars else None
    older = bars[1] if len(bars) > 1 else None
    history = list(reversed(bars))
    closes = [float(bar.close) for bar in history]
    def return_for(period: int):
        if len(closes) <= period or closes[-period - 1] == 0:
            return None
        return (closes[-1] / closes[-period - 1] - 1) * 100
    return {
        "symbol": code,
        "name": profile.name,
        "price": float(latest.close) if latest else None,
        "change": float(latest.close - older.close) if latest and older else None,
        "percentChange": (float(latest.close - older.close) / float(older.close) * 100) if latest and older and older.close else None,
        "volume": latest.volume if latest else None,
        "exchange": profile.exchange,
        "sector": profile.sector,
        "industry": profile.industry,
        "description": profile.description,
        "employees": profile.employees,
        "website": profile.website,
        "yearHigh": max((float(bar.high) for bar in history if bar.high is not None), default=None),
        "yearLow": min((float(bar.low) for bar in history if bar.low is not None), default=None),
        "avgVolume": (sum(bar.volume or 0 for bar in history) // len(history)) if history else None,
        "pb": float(fundamental.pb) if fundamental and fundamental.pb is not None else None,
        "eps": float(fundamental.eps) if fundamental and fundamental.eps is not None else None,
        "dividendYield": float(fundamental.dividend_yield) if fundamental and fundamental.dividend_yield is not None else None,
        "fundamentalAsOf": fundamental.as_of.isoformat() if fundamental else None,
        "fundamentalSource": fundamental.source if fundamental else None,
        "marketCap": float(fundamental.market_cap) if fundamental and fundamental.market_cap is not None else None,
        "pe": float(fundamental.pe) if fundamental and fundamental.pe is not None else None,
        "performance": [{"period": label, "percentChange": return_for(days)} for label, days in
                        (("5D", 5), ("1M", 21), ("3M", 63), ("6M", 126), ("1Y", 252))],
        "asOf": latest.trade_date.isoformat() if latest else None,
        "source": latest.source if latest else None,
        "dataMode": ("synthetic-demo" if latest.source == "csv-demo" else "market-provider") if latest else None,
    }


@router.get("/stocks/{symbol}/history")
async def stock_history(
    symbol: str,
    start: date | None = None,
    end: date | None = None,
    limit: int = Query(500, ge=1, le=2500),
):
    async with AsyncSessionLocal() as session:
        if await session.get(Symbol, symbol.upper()) is None:
            raise HTTPException(status_code=404, detail=f"Unknown symbol: {symbol.upper()}")
    source = get_configured_market_source_id()
    stmt = select(PriceBar).where(PriceBar.symbol == symbol.upper(), PriceBar.source == source)
    if start:
        stmt = stmt.where(PriceBar.trade_date >= start)
    if end:
        stmt = stmt.where(PriceBar.trade_date <= end)
    stmt = stmt.order_by(PriceBar.trade_date.desc()).limit(limit)
    async with AsyncSessionLocal() as session:
        bars = list((await session.scalars(stmt)).all())
    bars.reverse()
    return {
        "symbol": symbol.upper(),
        "items": [{
            "time": bar.trade_date.isoformat(),
            "open": float(bar.open) if bar.open is not None else None,
            "high": float(bar.high) if bar.high is not None else None,
            "low": float(bar.low) if bar.low is not None else None,
            "close": float(bar.close),
            "adjustedClose": float(bar.adjusted_close) if bar.adjusted_close is not None else None,
            "volume": bar.volume,
            "source": bar.source,
            "dataMode": "synthetic-demo" if bar.source == "csv-demo" else "market-provider",
        } for bar in bars],
        "asOf": bars[-1].trade_date.isoformat() if bars else None,
        "source": bars[-1].source if bars else None,
        "dataMode": ("synthetic-demo" if bars[-1].source == "csv-demo" else "market-provider") if bars else None,
    }


async def _indicator_values(symbol: str):
    async with AsyncSessionLocal() as session:
        profile = await session.get(Symbol, symbol.upper())
        if profile is None or not profile.is_active:
            raise HTTPException(status_code=404, detail=f"Unknown symbol: {symbol.upper()}")
        bars = list((await session.scalars(
            select(PriceBar).where(PriceBar.symbol == symbol.upper(), PriceBar.source == get_configured_market_source_id())
            .order_by(PriceBar.trade_date.desc()).limit(300)
        )).all())
    bars.reverse()
    if not bars:
        return None, None
    closes = pd.Series([float(bar.close) for bar in bars], dtype="float64")
    last_price = float(closes.iloc[-1])

    def last(series):
        value = series.iloc[-1]
        return float(value) if pd.notna(value) else None

    macd_line, macd_signal, macd_hist = macd(closes)
    bb_mid, bb_upper, bb_lower = bollinger(closes)
    indicators = {
        "rsi14": last(rsi(closes)),
        "macd": last(macd_line),
        "macdSignal": last(macd_signal),
        "macdHistogram": last(macd_hist),
        "sma20": last(sma(closes, 20)),
        "sma50": last(sma(closes, 50)),
        "sma200": last(sma(closes, 200)),
        "ema20": last(ema(closes, 20)),
        "ema50": last(ema(closes, 50)),
        "bollingerMiddle": last(bb_mid),
        "bollingerUpper": last(bb_upper),
        "bollingerLower": last(bb_lower),
    }
    return indicators, {"lastPrice": last_price, "asOf": bars[-1].trade_date.isoformat(),
                        "source": bars[-1].source,
                        "dataMode": "synthetic-demo" if bars[-1].source == "csv-demo" else "market-provider"}


@router.get("/stocks/{symbol}/indicators")
async def stock_indicators(symbol: str):
    indicators, meta = await _indicator_values(symbol)
    if indicators is None:
        return {"symbol": symbol.upper(), "indicators": None, "asOf": None, "source": None, "dataMode": None}
    return {"symbol": symbol.upper(), "indicators": indicators, **meta}


@router.get("/stocks/{symbol}/signals")
async def stock_signals(symbol: str):
    indicators, meta = await _indicator_values(symbol)
    if indicators is None:
        return {"symbol": symbol.upper(), "strongBuy": 0, "buy": 0, "neutral": 0,
                "sell": 0, "strongSell": 0, "summary": "insufficient_data", "asOf": None,
                "source": None, "dataMode": None}
    price = meta["lastPrice"]
    bb_range = (indicators["bollingerUpper"] - indicators["bollingerLower"]
                if indicators["bollingerUpper"] is not None and indicators["bollingerLower"] is not None else None)
    bb_position = ((price - indicators["bollingerLower"]) / bb_range
                   if bb_range else None)
    signal_values = [
        classify_indicator(indicators["rsi14"], "rsi"),
        classify_indicator(indicators["macdHistogram"], "macd_histogram"),
        classify_indicator(price - indicators["sma50"] if indicators["sma50"] is not None else None, "price_vs_ma"),
        classify_indicator(bb_position, "bollinger_position"),
    ]
    return {"symbol": symbol.upper(), **summarize_signals(signal_values), "asOf": meta["asOf"],
            "source": meta["source"], "dataMode": meta["dataMode"]}
