"""Generate deterministic, clearly synthetic market fixtures for local demos/tests."""

import csv
import hashlib
import math
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "seed_data"
SYMBOLS = {
    "VCB": (90000, 1_000_000), "ACB": (25000, 4_000_000), "MBB": (22000, 8_000_000),
    "BID": (48000, 2_000_000), "FPT": (125000, 3_000_000), "CMG": (60000, 600_000),
    "SSI": (30000, 6_000_000), "VRE": (27000, 3_000_000), "DXG": (18000, 5_000_000),
    "PVD": (25000, 2_000_000), "POW": (13000, 4_000_000), "GAS": (80000, 700_000),
    "HPG": (28000, 12_000_000), "SAB": (55000, 300_000), "KDC": (60000, 250_000),
}
INDICES = {"VNINDEX": (1250.0, 500_000_000), "HNXINDEX": (230.0, 80_000_000), "UPCOMINDEX": (95.0, 50_000_000)}
START = date(2024, 1, 1)
END = date(2026, 10, 30)


def stable_noise(key: str, index: int) -> float:
    digest = hashlib.sha256(f"{key}:{index}".encode()).digest()
    return (int.from_bytes(digest[:4], "big") / 0xFFFFFFFF) - 0.5


def dates():
    current = START
    while current <= END:
        if current.weekday() < 5:
            yield current
        current += timedelta(days=1)


def write_history(folder: Path, key: str, base: float, base_volume: int, *, indexed: bool = False):
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{key}.csv"
    prior = base
    rows = []
    for index, day in enumerate(dates()):
        cycle = math.sin(index / 34 + len(key)) * 0.003
        drift = 0.00008 if index % 160 < 100 else -0.00002
        close = max(base * 0.4, prior * (1 + drift + cycle + stable_noise(key, index) * 0.012))
        open_price = prior * (1 + stable_noise(key + "o", index) * 0.009)
        high = max(open_price, close) * (1 + abs(stable_noise(key + "h", index)) * 0.012)
        low = min(open_price, close) * (1 - abs(stable_noise(key + "l", index)) * 0.012)
        volume = max(1000, int(base_volume * (0.7 + abs(stable_noise(key + "v", index)) * 0.8)))
        if indexed:
            open_price, high, low, close = [round(value, 2) for value in (open_price, high, low, close)]
        else:
            open_price, high, low, close = [round(value / 100) * 100 for value in (open_price, high, low, close)]
        rows.append((day.isoformat(), open_price, high, low, close, volume))
        prior = close
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(("trade_date", "open", "high", "low", "close", "volume", "data_mode"))
        writer.writerows((*row, "synthetic-demo") for row in rows)
    return rows


def main():
    quote_rows = []
    for symbol, (price, volume) in SYMBOLS.items():
        history = write_history(ROOT / "price_bars", symbol, price, volume)
        day, open_price, high, low, close, traded = history[-1]
        prior = history[-2][4]
        quote_rows.append((symbol, "HOSE", close, close - prior, (close / prior - 1) * 100, traded, day, "synthetic-demo"))
    with (ROOT / "quotes.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(("symbol", "exchange", "current_price", "price_change", "percent_change", "volume", "as_of", "data_mode"))
        writer.writerows(quote_rows)
    index_rows = []
    for symbol, (price, volume) in INDICES.items():
        history = write_history(ROOT / "index_bars", symbol, price, volume, indexed=True)
        day, _, high, low, close, traded = history[-1]
        prior = history[-2][4]
        index_rows.append((symbol, close, close - prior, (close / prior - 1) * 100, traded, high, low, day, "synthetic-demo"))
    with (ROOT / "indices.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(("symbol", "points", "change", "percent_change", "volume", "high", "low", "as_of", "data_mode"))
        writer.writerows(index_rows)
    print(f"Generated synthetic fixtures for {len(SYMBOLS)} symbols and {len(INDICES)} indices: {START}..{END}")


if __name__ == "__main__":
    main()
