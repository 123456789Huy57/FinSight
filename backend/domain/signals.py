def classify_indicator(value: float | None, kind: str) -> str:
    if value is None:
        return "neutral"
    if kind == "rsi":
        return "strongSell" if value >= 80 else "sell" if value >= 70 else "strongBuy" if value <= 20 else "buy" if value <= 30 else "neutral"
    if kind == "macd_histogram":
        return "buy" if value > 0 else "sell" if value < 0 else "neutral"
    if kind == "price_vs_ma":
        return "strongBuy" if value > 0.05 else "buy" if value > 0 else "strongSell" if value < -0.05 else "sell" if value < 0 else "neutral"
    if kind == "bollinger_position":
        return "strongBuy" if value <= 0 else "buy" if value < 0.1 else "strongSell" if value >= 1 else "sell" if value > 0.9 else "neutral"
    return "neutral"


def summarize_signals(signals: list[str]) -> dict[str, int | str]:
    counts = {name: signals.count(name) for name in ("strongBuy", "buy", "neutral", "sell", "strongSell")}
    buys = counts["strongBuy"] + counts["buy"]
    sells = counts["strongSell"] + counts["sell"]
    summary = "bullish" if buys > sells else "bearish" if sells > buys else "neutral"
    return {**counts, "summary": summary}
