import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from api.v1.auth import current_user
from db.models import PortfolioPosition, PortfolioTransaction, Symbol, User, WatchlistItem
from db.session import AsyncSessionLocal
from domain.portfolio import remaining_quantity, weighted_average_cost

router = APIRouter(prefix="/api/v1", tags=["v1 account"])


class WatchlistInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=12, pattern="^[A-Za-z0-9.]+$")


class TradeInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=12, pattern="^[A-Za-z0-9.]+$")
    side: str = Field(pattern="^(BUY|SELL)$")
    quantity: int = Field(gt=0, le=100_000_000)
    price: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    fee: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=4)


@router.get("/watchlist")
async def get_watchlist(user: User = Depends(current_user)):
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(WatchlistItem, Symbol).join(Symbol, Symbol.symbol == WatchlistItem.symbol)
            .where(WatchlistItem.user_id == user.id).order_by(WatchlistItem.created_at.desc())
        )).all()
    return {"items": [{"symbol": item.symbol, "name": symbol.name, "exchange": symbol.exchange,
                       "sector": symbol.sector,
                       "createdAt": item.created_at.isoformat() if item.created_at else None}
                      for item, symbol in rows]}


@router.post("/watchlist", status_code=201)
async def add_watchlist(payload: WatchlistInput, user: User = Depends(current_user)):
    symbol = payload.symbol.upper()
    async with AsyncSessionLocal.begin() as session:
        if not await session.get(Symbol, symbol):
            raise HTTPException(status_code=404, detail=f"Unknown symbol: {symbol}")
        if await session.get(WatchlistItem, (user.id, symbol)):
            raise HTTPException(status_code=409, detail="Symbol is already in your watchlist")
        session.add(WatchlistItem(user_id=user.id, symbol=symbol))
    return {"symbol": symbol, "added": True}


@router.delete("/watchlist/{symbol}", status_code=204)
async def remove_watchlist(symbol: str, user: User = Depends(current_user)):
    code = symbol.upper()
    async with AsyncSessionLocal.begin() as session:
        item = await session.get(WatchlistItem, (user.id, code))
        if not item:
            raise HTTPException(status_code=404, detail="Watchlist symbol was not found")
        await session.delete(item)


@router.get("/portfolio/positions")
async def get_positions(user: User = Depends(current_user)):
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(PortfolioPosition, Symbol).join(Symbol, Symbol.symbol == PortfolioPosition.symbol)
            .where(PortfolioPosition.user_id == user.id).order_by(PortfolioPosition.symbol)
        )).all()
    return {"items": [{"symbol": position.symbol, "name": symbol.name, "quantity": position.quantity,
                       "averageCost": float(position.average_cost)} for position, symbol in rows]}


@router.get("/portfolio/transactions")
async def get_transactions(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    user: User = Depends(current_user),
):
    async with AsyncSessionLocal() as session:
        rows = list((await session.scalars(
            select(PortfolioTransaction).where(PortfolioTransaction.user_id == user.id)
            .order_by(PortfolioTransaction.created_at.desc()).limit(limit).offset(offset)
        )).all())
    return {"items": [{"id": row.id, "symbol": row.symbol, "side": row.side,
                       "quantity": row.quantity, "price": float(row.price), "fee": float(row.fee),
                       "tax": float(row.tax), "createdAt": row.created_at.isoformat() if row.created_at else None}
                      for row in rows], "limit": limit, "offset": offset}


@router.post("/portfolio/trades", status_code=201)
async def record_trade(payload: TradeInput, user: User = Depends(current_user)):
    symbol = payload.symbol.upper()
    async with AsyncSessionLocal.begin() as session:
        locked_user = await session.scalar(select(User).where(User.id == user.id).with_for_update())
        if not locked_user:
            raise HTTPException(status_code=401, detail="Account is unavailable")
        if not await session.get(Symbol, symbol):
            raise HTTPException(status_code=404, detail=f"Unknown symbol: {symbol}")
        position = await session.get(PortfolioPosition, (user.id, symbol), with_for_update=True)
        tax = (payload.price * payload.quantity * Decimal("0.001")) if payload.side == "SELL" else Decimal("0")
        if payload.side == "BUY":
            old_quantity = position.quantity if position else 0
            old_average = Decimal(position.average_cost) if position else Decimal("0")
            average = weighted_average_cost(old_quantity, old_average, payload.quantity, payload.price, payload.fee)
            if position:
                position.quantity += payload.quantity
                position.average_cost = average
            else:
                position = PortfolioPosition(user_id=user.id, symbol=symbol, quantity=payload.quantity,
                                             average_cost=average)
                session.add(position)
        else:
            if not position:
                raise HTTPException(status_code=409, detail="Cannot sell a symbol with no position")
            try:
                left = remaining_quantity(position.quantity, payload.quantity)
            except ValueError:
                raise HTTPException(status_code=409, detail="Sell quantity exceeds the current position") from None
            if left:
                position.quantity = left
            else:
                await session.delete(position)
        session.add(PortfolioTransaction(id=str(uuid.uuid4()), user_id=user.id, symbol=symbol,
                                         side=payload.side, quantity=payload.quantity, price=payload.price,
                                         fee=payload.fee, tax=tax))
    return {"symbol": symbol, "side": payload.side, "quantity": payload.quantity,
            "fee": float(payload.fee), "tax": float(tax)}
