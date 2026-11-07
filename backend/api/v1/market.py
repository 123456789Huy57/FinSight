from collections import defaultdict

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from db.models import IndexBar, PriceBar, ProviderJobRun, Symbol
from db.session import AsyncSessionLocal
from domain.provider_status import market_data_status
from providers.factory import get_configured_market_source_id

router = APIRouter(prefix="/api/v1/market", tags=["v1 market"])


def _configured_data_mode() -> str:
    return "synthetic-demo" if get_configured_market_source_id() == "csv-demo" else "market-provider"


async def _latest_bars():
    source = get_configured_market_source_id()
    latest_dates = select(PriceBar.symbol, func.max(PriceBar.trade_date).label("trade_date")).where(PriceBar.source == source).group_by(PriceBar.symbol).subquery()
    previous_dates = (
        select(PriceBar.symbol, func.max(PriceBar.trade_date).label("trade_date"))
        .join(latest_dates, latest_dates.c.symbol == PriceBar.symbol)
        .where(PriceBar.trade_date < latest_dates.c.trade_date, PriceBar.source == source)
        .group_by(PriceBar.symbol)
        .subquery()
    )
    previous = PriceBar.__table__.alias("market_previous_bar")
    stmt = (
        select(Symbol, PriceBar, previous.c.close.label("previous_close"))
        .join(latest_dates, latest_dates.c.symbol == Symbol.symbol)
        .join(PriceBar, (PriceBar.symbol == Symbol.symbol) & (PriceBar.trade_date == latest_dates.c.trade_date) & (PriceBar.source == source))
        .outerjoin(previous_dates, previous_dates.c.symbol == Symbol.symbol)
        .outerjoin(previous, (previous.c.symbol == Symbol.symbol) & (previous.c.trade_date == previous_dates.c.trade_date) & (previous.c.source == source))
        .where(Symbol.is_active.is_(True))
    )
    async with AsyncSessionLocal() as session:
        return (await session.execute(stmt)).all()


def _stock_row(symbol: Symbol, bar: PriceBar, previous_close):
    change = float(bar.close - previous_close) if previous_close is not None else None
    pct = change / float(previous_close) * 100 if change is not None and previous_close else None
    return {
        "symbol": symbol.symbol,
        "name": symbol.name,
        "exchange": symbol.exchange,
        "sector": symbol.sector,
        "price": float(bar.close),
        "change": change,
        "percentChange": pct,
        "volume": bar.volume,
        "asOf": bar.trade_date.isoformat(),
        "source": bar.source,
        "dataMode": "synthetic-demo" if bar.source == "csv-demo" else "market-provider",
    }


@router.get("/overview")
async def overview():
    rows = await _latest_bars()
    stocks = [_stock_row(*row) for row in rows]
    advancing = sum(1 for item in stocks if item["percentChange"] is not None and item["percentChange"] > 0)
    declining = sum(1 for item in stocks if item["percentChange"] is not None and item["percentChange"] < 0)
    unchanged = sum(1 for item in stocks if item["percentChange"] == 0)
    sectors: dict[str, list[float]] = defaultdict(list)
    for item in stocks:
        if item["sector"] and item["percentChange"] is not None:
            sectors[item["sector"]].append(item["percentChange"])
    sector_items = [
        {"sector": name, "vietnamName": name, "change": sum(changes) / len(changes),
         "percentChange": sum(changes) / len(changes), "leaders": []}
        for name, changes in sectors.items()
    ]
    sector_items.sort(key=lambda item: item["percentChange"], reverse=True)
    changes = [item["percentChange"] for item in stocks if item["percentChange"] is not None]
    source = get_configured_market_source_id()
    return {
        "asOf": max((item["asOf"] for item in stocks), default=None),
        "source": source,
        "dataMode": _configured_data_mode(),
        "indices": await _index_rows(),
        "movers": {
            "gainers": sorted(stocks, key=lambda item: item["percentChange"] if item["percentChange"] is not None else float("-inf"), reverse=True)[:10],
            "losers": sorted(stocks, key=lambda item: item["percentChange"] if item["percentChange"] is not None else float("inf"))[:10],
        },
        "breadth": {"advancing": advancing, "declining": declining, "unchanged": unchanged,
                    "totalVolume": sum(item["volume"] or 0 for item in stocks),
                    "source": source, "dataMode": _configured_data_mode()},
        "sectors": sector_items,
        "averageChange": sum(changes) / len(changes) if changes else None,
    }


@router.get("/commentary")
async def commentary():
    snapshot = await overview()
    breadth = snapshot["breadth"]
    advancing, declining = breadth["advancing"], breadth["declining"]
    direction = "tăng" if advancing > declining else "giảm" if declining > advancing else "cân bằng"
    sectors = snapshot["sectors"]
    gainers = snapshot["movers"]["gainers"]
    losers = snapshot["movers"]["losers"]
    average = snapshot["averageChange"]
    summary = (
        f"Độ rộng thị trường đang {direction}: {advancing} mã tăng, {declining} mã giảm, "
        f"{breadth['unchanged']} mã đứng giá trong dữ liệu đã đồng bộ."
    )
    drivers = []
    if sectors:
        leaders = ", ".join(item["sector"] for item in sectors[:3])
        drivers.append(f"Nhóm ngành có biến động bình quân tích cực gồm {leaders}.")
    if average is not None:
        drivers.append(f"Mức thay đổi bình quân của các mã có dữ liệu là {average:.2f}%.")
    return {
        "headline": f"Độ rộng nghiêng về phía {direction}",
        "summary": summary,
        "keyDrivers": drivers,
        "bullishFactors": [f"{len(gainers)} mã dẫn đầu có dữ liệu tăng giá."] if gainers else [],
        "riskFactors": [f"{len(losers)} mã dẫn đầu có dữ liệu giảm giá."] if losers else [],
        "watchNext": ["Theo dõi phiên dữ liệu kế tiếp; số liệu trong ngày phụ thuộc thời điểm provider cập nhật."],
        "breadth": breadth,
        "leadingSectors": sectors[:3],
        "weakSectors": list(reversed(sectors[-3:])),
        "topGainers": gainers[:5],
        "topLosers": losers[:5],
        "asOf": snapshot["asOf"],
        "source": snapshot["source"],
        "dataMode": snapshot["dataMode"],
        "method": "rule_based_snapshot",
    }


async def _index_rows():
    source = get_configured_market_source_id()
    latest_dates = select(IndexBar.index_symbol, func.max(IndexBar.trade_date).label("trade_date")).where(
        IndexBar.source == source
    ).group_by(IndexBar.index_symbol).subquery()
    previous_dates = (
        select(IndexBar.index_symbol, func.max(IndexBar.trade_date).label("trade_date"))
        .join(latest_dates, latest_dates.c.index_symbol == IndexBar.index_symbol)
        .where(IndexBar.trade_date < latest_dates.c.trade_date, IndexBar.source == source)
        .group_by(IndexBar.index_symbol).subquery()
    )
    previous = IndexBar.__table__.alias("index_previous_bar")
    stmt = select(IndexBar, previous.c.close.label("previous_close")).join(
        latest_dates, (latest_dates.c.index_symbol == IndexBar.index_symbol) & (latest_dates.c.trade_date == IndexBar.trade_date)
        & (IndexBar.source == source)
    ).outerjoin(previous_dates, previous_dates.c.index_symbol == IndexBar.index_symbol).outerjoin(
        previous, (previous.c.index_symbol == IndexBar.index_symbol) & (previous.c.trade_date == previous_dates.c.trade_date)
        & (previous.c.source == source)
    )
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(stmt)).all()
    result = []
    for bar, previous_close in rows:
        change = float(bar.close - previous_close) if previous_close is not None else None
        result.append({
            "symbol": bar.index_symbol, "name": bar.index_symbol, "vietnamName": bar.index_symbol,
            "price": float(bar.close), "change": change,
            "percentChange": change / float(previous_close) * 100 if change is not None and previous_close else None,
            "high": float(bar.high) if bar.high is not None else None,
            "low": float(bar.low) if bar.low is not None else None,
            "volume": bar.volume, "asOf": bar.trade_date.isoformat(),
            "source": bar.source,
            "dataMode": "synthetic-demo" if bar.source == "csv-demo" else "market-provider",
        })
    return result


@router.get("/indices")
async def indices():
    rows = await _index_rows()
    return {"items": rows, "asOf": max((row["asOf"] for row in rows), default=None),
            "source": get_configured_market_source_id(), "dataMode": _configured_data_mode()}


@router.get("/data-status")
async def data_status():
    source = get_configured_market_source_id()
    async with AsyncSessionLocal() as session:
        latest_price = await session.scalar(
            select(func.max(PriceBar.trade_date)).where(PriceBar.source == source)
        )
        latest_index = await session.scalar(
            select(func.max(IndexBar.trade_date)).where(IndexBar.source == source)
        )
        last_run = await session.scalar(
            select(ProviderJobRun).where(
                ProviderJobRun.source == source,
                ProviderJobRun.job_name == "price-history",
            ).order_by(ProviderJobRun.started_at.desc()).limit(1)
        )
    status, stale = market_data_status(latest_price is not None, last_run.status if last_run else None)
    return {
        "source": source,
        "dataMode": "synthetic-demo" if source == "csv-demo" else "market-provider",
        "status": status,
        "stale": stale,
        "priceAsOf": latest_price.isoformat() if latest_price else None,
        "indexAsOf": latest_index.isoformat() if latest_index else None,
        "lastRun": None if last_run is None else {
            "status": last_run.status,
            "startedAt": last_run.started_at,
            "finishedAt": last_run.finished_at,
            "summary": last_run.summary,
        },
    }


@router.get("/breadth")
async def breadth():
    stocks = [_stock_row(*row) for row in await _latest_bars()]
    changes = [item["percentChange"] for item in stocks if item["percentChange"] is not None]
    return {
        "advancing": sum(value > 0 for value in changes),
        "declining": sum(value < 0 for value in changes),
        "unchanged": sum(value == 0 for value in changes),
        "totalVolume": sum(item["volume"] or 0 for item in stocks),
        "asOf": max((item["asOf"] for item in stocks), default=None),
        "source": get_configured_market_source_id(), "dataMode": _configured_data_mode(),
    }


@router.get("/sectors")
async def sectors():
    stocks = [_stock_row(*row) for row in await _latest_bars()]
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in stocks:
        if item["sector"]:
            grouped[item["sector"]].append(item)
    items = []
    for name, members in grouped.items():
        changes = [item["percentChange"] for item in members if item["percentChange"] is not None]
        items.append({
            "sector": name,
            "vietnamName": name,
            "change": sum(changes) / len(changes) if changes else None,
            "percentChange": sum(changes) / len(changes) if changes else None,
            "leaders": sorted(members, key=lambda item: item["percentChange"] or 0, reverse=True)[:5],
            "stockCount": len(members),
        })
    items.sort(key=lambda item: item["percentChange"] if item["percentChange"] is not None else float("-inf"), reverse=True)
    return {"items": items, "asOf": max((item["asOf"] for item in stocks), default=None),
            "source": get_configured_market_source_id(), "dataMode": _configured_data_mode()}


@router.get("/movers")
async def movers(
    type: str = Query("gainers", pattern="^(gainers|losers)$"),
    limit: int = Query(10, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stocks = [_stock_row(*row) for row in await _latest_bars()]
    stocks = [item for item in stocks if item["percentChange"] is not None]
    stocks.sort(key=lambda item: item["percentChange"], reverse=(type == "gainers"))
    return {"items": stocks[offset:offset + limit], "total": len(stocks), "limit": limit, "offset": offset,
            "asOf": max((item["asOf"] for item in stocks), default=None),
            "source": get_configured_market_source_id(), "dataMode": _configured_data_mode()}


@router.get("/active")
async def most_active(limit: int = Query(10, ge=1, le=200), offset: int = Query(0, ge=0)):
    stocks = [_stock_row(*row) for row in await _latest_bars()]
    stocks.sort(key=lambda item: item["volume"] if item["volume"] is not None else -1, reverse=True)
    return {"items": stocks[offset:offset + limit], "total": len(stocks), "limit": limit,
            "offset": offset, "asOf": max((item["asOf"] for item in stocks), default=None),
            "source": get_configured_market_source_id(), "dataMode": _configured_data_mode()}
