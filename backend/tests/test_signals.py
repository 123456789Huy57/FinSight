from domain.signals import classify_indicator, summarize_signals


def test_indicator_classification_covers_five_levels():
    assert classify_indicator(15, "rsi") == "strongBuy"
    assert classify_indicator(25, "rsi") == "buy"
    assert classify_indicator(50, "rsi") == "neutral"
    assert classify_indicator(75, "rsi") == "sell"
    assert classify_indicator(85, "rsi") == "strongSell"


def test_signal_summary_counts_and_direction():
    summary = summarize_signals(["strongBuy", "buy", "neutral", "sell"])
    assert summary == {"strongBuy": 1, "buy": 1, "neutral": 1, "sell": 1, "strongSell": 0, "summary": "bullish"}


def test_all_indicator_kinds_and_missing_values():
    assert classify_indicator(None, "rsi") == "neutral"
    assert classify_indicator(0.1, "macd_histogram") == "buy"
    assert classify_indicator(-0.1, "macd_histogram") == "sell"
    assert classify_indicator(0, "macd_histogram") == "neutral"
    assert classify_indicator(0.06, "price_vs_ma") == "strongBuy"
    assert classify_indicator(0.01, "price_vs_ma") == "buy"
    assert classify_indicator(-0.01, "price_vs_ma") == "sell"
    assert classify_indicator(-0.06, "price_vs_ma") == "strongSell"
    assert classify_indicator(-0.1, "bollinger_position") == "strongBuy"
    assert classify_indicator(0.05, "bollinger_position") == "buy"
    assert classify_indicator(0.95, "bollinger_position") == "sell"
    assert classify_indicator(1.1, "bollinger_position") == "strongSell"
    assert classify_indicator(1, "unknown") == "neutral"


def test_signal_summary_bearish_and_neutral():
    assert summarize_signals(["sell", "strongSell"])["summary"] == "bearish"
    assert summarize_signals(["neutral"])["summary"] == "neutral"
