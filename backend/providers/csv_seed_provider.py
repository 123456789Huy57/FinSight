from datetime import date
from pathlib import Path

import pandas as pd

from providers.base import MarketDataProvider

SEED_DIR = Path(__file__).resolve().parents[1] / "scripts" / "seed_data"


class CsvSeedProvider(MarketDataProvider):
    """Explicit demo/test provider. CSV rows are never presented as live data."""

    source_id = "csv-demo"
    data_mode = "synthetic-demo"
    stock_price_multiplier = 1.0

    def _read(self, filename: str) -> pd.DataFrame:
        path = SEED_DIR / filename
        return pd.read_csv(path) if path.exists() else pd.DataFrame()

    def list_symbols(self) -> pd.DataFrame:
        return self._read("symbols.csv")

    def get_quote_snapshot(self, symbols: list[str]) -> pd.DataFrame:
        frame = self._read("quotes.csv")
        if frame.empty or "symbol" not in frame:
            return pd.DataFrame()
        return frame.loc[frame["symbol"].astype(str).str.upper().isin([s.upper() for s in symbols])]

    def get_ohlcv(self, symbol: str, start: date, end: date, interval: str = "1D") -> pd.DataFrame:
        if interval != "1D":
            raise ValueError("CSV seed provider supports daily bars only")
        frame = self._read(f"price_bars/{symbol.upper()}.csv")
        if frame.empty:
            return frame
        frame["trade_date"] = pd.to_datetime(frame["trade_date"])
        return frame.loc[frame["trade_date"].between(pd.Timestamp(start), pd.Timestamp(end))].reset_index(drop=True)

    def get_index_snapshot(self) -> pd.DataFrame:
        return self._read("indices.csv")

    def get_index_history(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        frame = self._read(f"index_bars/{symbol.upper()}.csv")
        if frame.empty:
            return frame
        frame["trade_date"] = pd.to_datetime(frame["trade_date"])
        return frame.loc[frame["trade_date"].between(pd.Timestamp(start), pd.Timestamp(end))].reset_index(drop=True)

    def get_company_profile(self, symbol: str) -> dict[str, str | None]:
        frame = self.list_symbols()
        if frame.empty:
            return {"symbol": symbol.upper(), "name": None, "exchange": None}
        matches = frame.loc[frame["symbol"].astype(str).str.upper() == symbol.upper()]
        if matches.empty:
            return {"symbol": symbol.upper(), "name": None, "exchange": None}
        row = matches.iloc[0]
        return {"symbol": symbol.upper(), "name": row.get("name"), "exchange": row.get("exchange")}
