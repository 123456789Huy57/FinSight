"""Background market snapshot worker.

Run with: python worker.py
It refreshes before market open and periodically during the trading session so
the first user request reads a warm cache instead of waiting for every batch.
"""

import time
from datetime import datetime

from services.stock_service import refresh_market_snapshot


REFRESH_SECONDS = 60


def main() -> None:
    while True:
        started = datetime.now()
        result = refresh_market_snapshot()
        count = len(result.get("df", [])) if hasattr(result.get("df"), "__len__") else 0
        if result.get("error"):
            print(f"[{started.isoformat()}] snapshot failed: {result['error']}", flush=True)
        else:
            print(f"[{started.isoformat()}] snapshot refreshed: {count} rows", flush=True)
        time.sleep(REFRESH_SECONDS)


if __name__ == "__main__":
    main()
