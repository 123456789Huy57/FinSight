import pandas as pd

from domain.indicators import bollinger, ema, macd, rsi, sma


def test_sma_and_ema_wait_for_full_warmup():
    values = pd.Series([1.0, 2.0, 3.0, 4.0])
    assert pd.isna(sma(values, 3).iloc[1])
    assert sma(values, 3).iloc[2] == 2.0
    assert pd.isna(ema(values, 3).iloc[1])
    assert ema(values, 3).iloc[2] == 2.25


def test_rsi_handles_flat_and_one_direction_series():
    flat = rsi(pd.Series([10.0] * 20), 14)
    rising = rsi(pd.Series(range(20), dtype="float64"), 14)
    falling = rsi(pd.Series(range(20, 0, -1), dtype="float64"), 14)
    assert flat.iloc[-1] == 50
    assert rising.iloc[-1] == 100
    assert falling.iloc[-1] == 0


def test_macd_and_bollinger_are_ordered():
    values = pd.Series(range(1, 80), dtype="float64")
    line, signal, histogram = macd(values)
    middle, upper, lower = bollinger(values)
    assert line.iloc[-1] > signal.iloc[-1]
    assert histogram.iloc[-1] == line.iloc[-1] - signal.iloc[-1]
    assert lower.iloc[-1] < middle.iloc[-1] < upper.iloc[-1]
