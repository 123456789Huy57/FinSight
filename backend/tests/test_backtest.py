from datetime import date, timedelta

from domain.backtest import Bar, run_backtest


def _bars():
    return [Bar(f"2026-01-{day:02d}", 10_000 + day * 100, 10_100 + day * 100,
                9_900 + day * 100, 10_000 + day * 100) for day in range(1, 20)]


def test_buy_hold_executes_next_session_at_open_and_round_lot():
    result = run_backtest(_bars(), "buy_hold", 10_000_000)
    first = result["trades"][0]
    assert first["day"] == "2026-01-02"
    assert first["price"] == 10_200
    assert first["quantity"] % 100 == 0
    assert result["tradeCount"] == 1


def test_backtest_rejects_lookalike_unknown_strategy():
    import pytest

    with pytest.raises(ValueError):
        run_backtest(_bars(), "future_peeking")


def test_backtest_rejects_invalid_inputs():
    import pytest

    with pytest.raises(ValueError):
        run_backtest(_bars()[:1], "buy_hold")
    with pytest.raises(ValueError):
        run_backtest(_bars(), "buy_hold", 0)
    with pytest.raises(ValueError):
        run_backtest(_bars(), "buy_hold", lot_size=0)


def test_dca_schedules_repeated_buys_at_next_open():
    first_day = date(2026, 1, 1)
    bars = [Bar((first_day + timedelta(days=day)).isoformat(), 10_000, 10_100, 9_900, 10_000)
            for day in range(45)]
    result = run_backtest(bars, "dca", 100_000_000)
    assert [trade["day"] for trade in result["trades"]] == [
        "2026-01-02", "2026-01-23", "2026-02-13",
    ]
    assert all(trade["side"] == "BUY" for trade in result["trades"])


def test_rsi_strategy_buys_after_decline_and_sells_after_recovery():
    closes = [100 - day for day in range(20)] + [81 + day * 2 for day in range(25)]
    bars = [Bar(f"day-{day:03}", close, close + 1, close - 1, close) for day, close in enumerate(closes)]
    result = run_backtest(bars, "rsi_mean_reversion", 10_000_000)
    assert result["trades"][0]["side"] == "BUY"
    assert any(trade["side"] == "SELL" for trade in result["trades"])
