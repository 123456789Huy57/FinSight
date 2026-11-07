import pandas as pd


def sma(close: pd.Series, period: int) -> pd.Series:
    """Simple moving average over the trailing period closes."""
    return close.rolling(period, min_periods=period).mean()


def ema(close: pd.Series, period: int) -> pd.Series:
    """Exponentially weighted moving average with an explicit warm-up window."""
    return close.ewm(span=period, adjust=False, min_periods=period).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """RSI using Wilder's smoothed average gains and losses."""
    if period < 1:
        raise ValueError("period must be positive")
    delta = close.diff()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = losses.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    relative_strength = avg_gain / avg_loss.where(avg_loss != 0)
    values = 100 - (100 / (1 + relative_strength))
    values = values.mask((avg_loss == 0) & (avg_gain > 0), 100)
    values = values.mask((avg_gain == 0) & (avg_loss > 0), 0)
    values = values.mask((avg_gain == 0) & (avg_loss == 0), 50)
    return values


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[pd.Series, pd.Series, pd.Series]:
    line = ema(close, fast) - ema(close, slow)
    signal_line = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return line, signal_line, line - signal_line


def bollinger(close: pd.Series, period: int = 20, deviations: float = 2) -> tuple[pd.Series, pd.Series, pd.Series]:
    middle = sma(close, period)
    standard_deviation = close.rolling(period, min_periods=period).std(ddof=0)
    return middle, middle + deviations * standard_deviation, middle - deviations * standard_deviation
