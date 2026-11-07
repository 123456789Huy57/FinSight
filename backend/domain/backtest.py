from dataclasses import dataclass
from math import sqrt
from statistics import mean, pstdev
from typing import Any


@dataclass(frozen=True)
class Bar:
    day: str
    open: float
    high: float
    low: float
    close: float


@dataclass(frozen=True)
class Trade:
    day: str
    side: str
    quantity: int
    price: float
    fee: float
    tax: float


def run_backtest(
    bars: list[Bar],
    strategy: str,
    initial_capital: float = 100_000_000,
    fee_rate: float = 0.0015,
    sell_tax_rate: float = 0.001,
    lot_size: int = 100,
) -> dict[str, Any]:
    """Simulate signals at close and fill pending orders at the next session open."""
    if strategy not in {"buy_hold", "dca", "sma_crossover", "rsi_mean_reversion"}:
        raise ValueError("Unknown backtest strategy")
    if len(bars) < 2 or initial_capital <= 0 or lot_size <= 0:
        raise ValueError("Backtest needs at least two bars and positive capital/lot size")
    ordered = sorted(bars, key=lambda bar: bar.day)
    cash = initial_capital
    shares = 0
    pending: tuple[str, float] | None = None
    trades: list[Trade] = []
    equity_curve: list[float] = []
    closes = [bar.close for bar in ordered]

    for index, bar in enumerate(ordered):
        if pending:
            side, allocation = pending
            if side == "BUY" and bar.open > 0:
                budget = min(cash, initial_capital * allocation)
                quantity = int(budget / (bar.open * (1 + fee_rate)) / lot_size) * lot_size
                if quantity:
                    gross = quantity * bar.open
                    fee = gross * fee_rate
                    cash -= gross + fee
                    shares += quantity
                    trades.append(Trade(bar.day, side, quantity, bar.open, fee, 0))
            elif side == "SELL" and shares:
                gross = shares * bar.open
                fee = gross * fee_rate
                tax = gross * sell_tax_rate
                cash += gross - fee - tax
                trades.append(Trade(bar.day, side, shares, bar.open, fee, tax))
                shares = 0
            pending = None

        equity_curve.append(cash + shares * bar.close)
        if index == len(ordered) - 1:
            continue
        if strategy == "buy_hold" and index == 0:
            pending = ("BUY", 1.0)
        elif strategy == "dca" and index % 21 == 0:
            pending = ("BUY", 0.1)
        elif strategy == "sma_crossover" and index >= 50:
            short_now = mean(closes[index - 19:index + 1])
            long_now = mean(closes[index - 49:index + 1])
            short_before = mean(closes[index - 20:index])
            long_before = mean(closes[index - 50:index])
            if short_before <= long_before and short_now > long_now and not shares:
                pending = ("BUY", 1.0)
            elif short_before >= long_before and short_now < long_now and shares:
                pending = ("SELL", 1.0)
        elif strategy == "rsi_mean_reversion" and index >= 14:
            value = _rsi(closes[:index + 1], 14)
            if value <= 30 and not shares:
                pending = ("BUY", 1.0)
            elif value >= 70 and shares:
                pending = ("SELL", 1.0)

    returns = [current / previous - 1 for previous, current in zip(equity_curve, equity_curve[1:]) if previous > 0]
    peak = equity_curve[0]
    max_drawdown = 0.0
    for value in equity_curve:
        peak = max(peak, value)
        if peak:
            max_drawdown = min(max_drawdown, value / peak - 1)
    total_return = equity_curve[-1] / initial_capital - 1
    elapsed_days = max(1, (len(ordered) - 1) * 365.25 / 252)
    cagr = (equity_curve[-1] / initial_capital) ** (365.25 / elapsed_days) - 1 if equity_curve[-1] > 0 else -1
    volatility = pstdev(returns) * sqrt(252) if len(returns) > 1 else 0.0
    sharpe = mean(returns) / pstdev(returns) * sqrt(252) if len(returns) > 1 and pstdev(returns) else 0.0
    return {
        "strategy": strategy,
        "initialCapital": initial_capital,
        "finalEquity": equity_curve[-1],
        "totalReturn": total_return,
        "cagr": cagr,
        "maxDrawdown": max_drawdown,
        "annualizedVolatility": volatility,
        "sharpeRatio": sharpe,
        "tradeCount": len(trades),
        "trades": [trade.__dict__ for trade in trades],
        "equityCurve": [{"index": index, "equity": value} for index, value in enumerate(equity_curve)],
    }


def _rsi(values: list[float], period: int) -> float:
    changes = [current - previous for previous, current in zip(values, values[1:])]
    recent = changes[-period:]
    gains = sum(max(value, 0) for value in recent) / period
    losses = sum(max(-value, 0) for value in recent) / period
    if gains == 0 and losses == 0:
        return 50.0
    if losses == 0:
        return 100.0
    return 100 - 100 / (1 + gains / losses)
