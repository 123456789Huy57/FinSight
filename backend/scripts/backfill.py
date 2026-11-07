import argparse
import asyncio
from datetime import date, timedelta

from jobs.ingest_prices import ingest_price_history


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill daily stock bars into PostgreSQL")
    parser.add_argument("--years", type=int, default=5, help="History window (1-20 years)")
    parser.add_argument("--symbol", action="append", help="Limit to a ticker; repeat to select multiple")
    parser.add_argument("--delay", type=float, default=None, help="Delay between provider requests (provider default if omitted)")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    if not 1 <= args.years <= 20:
        raise SystemExit("--years must be between 1 and 20")
    summary = await ingest_price_history(
        start=date.today() - timedelta(days=args.years * 366),
        end=date.today(),
        symbols=args.symbol,
        request_delay_seconds=max(0, args.delay) if args.delay is not None else None,
    )
    print(summary)


if __name__ == "__main__":
    asyncio.run(main())
