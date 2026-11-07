import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.v1.auth import current_user
from db.models import BacktestRun, PriceBar, User
from db.session import AsyncSessionLocal
from domain.backtest import Bar, run_backtest
from providers.factory import get_configured_market_source_id

router = APIRouter(prefix="/api/v1/backtests", tags=["v1 backtests"])


class BacktestInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=12, pattern="^[A-Za-z0-9.]+$")
    strategy: str = Field(pattern="^(buy_hold|dca|sma_crossover|rsi_mean_reversion)$")
    start: date
    end: date
    initialCapital: float = Field(default=100_000_000, gt=0, le=100_000_000_000)


@router.post("")
async def backtest(payload: BacktestInput, user: User = Depends(current_user)):
    if payload.start >= payload.end:
        raise HTTPException(status_code=422, detail="start must be earlier than end")
    async with AsyncSessionLocal() as session:
        rows = list((await session.scalars(
            select(PriceBar).where(PriceBar.symbol == payload.symbol.upper(),
                                   PriceBar.trade_date.between(payload.start, payload.end),
                                   PriceBar.source == get_configured_market_source_id())
            .order_by(PriceBar.trade_date)
        )).all())
    if len(rows) < 2:
        raise HTTPException(status_code=422, detail="Not enough historical bars for this backtest")
    bars = [Bar(row.trade_date.isoformat(), float(row.open or row.close),
                float(row.high or row.close), float(row.low or row.close), float(row.close)) for row in rows]
    result = run_backtest(bars, payload.strategy, payload.initialCapital)
    benchmark = run_backtest(bars, "buy_hold", payload.initialCapital)
    result["benchmark"] = {
        "strategy": "buy_hold",
        "totalReturn": benchmark["totalReturn"],
        "finalEquity": benchmark["finalEquity"],
        "excessReturn": result["totalReturn"] - benchmark["totalReturn"],
    }
    run_id = str(uuid.uuid4())
    async with AsyncSessionLocal.begin() as session:
        session.add(BacktestRun(
            id=run_id, user_id=user.id, symbol=payload.symbol.upper(), strategy=payload.strategy,
            start_date=rows[0].trade_date, end_date=rows[-1].trade_date,
            source=rows[0].source, result=result,
        ))
    return {"id": run_id, "symbol": payload.symbol.upper(), "start": rows[0].trade_date.isoformat(),
            "end": rows[-1].trade_date.isoformat(), "source": rows[0].source, **result}


@router.get("")
async def list_backtests(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
):
    async with AsyncSessionLocal() as session:
        rows = list((await session.scalars(
            select(BacktestRun).where(BacktestRun.user_id == user.id)
            .order_by(BacktestRun.created_at.desc()).limit(limit).offset(offset)
        )).all())
    return {"items": [_serialize_run(row) for row in rows], "limit": limit, "offset": offset}


@router.get("/{run_id}")
async def get_backtest(run_id: str, user: User = Depends(current_user)):
    async with AsyncSessionLocal() as session:
        row = await session.scalar(select(BacktestRun).where(
            BacktestRun.id == run_id, BacktestRun.user_id == user.id,
        ))
    if row is None:
        raise HTTPException(status_code=404, detail="Backtest run was not found")
    return _serialize_run(row)


def _serialize_run(row: BacktestRun) -> dict:
    return {"id": row.id, "symbol": row.symbol, "strategy": row.strategy,
            "start": row.start_date.isoformat(), "end": row.end_date.isoformat(),
            "source": row.source, "createdAt": row.created_at.isoformat() if row.created_at else None,
            **row.result}
