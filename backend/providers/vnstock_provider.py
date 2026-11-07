from datetime import date
from functools import lru_cache

import pandas as pd

from core.config import settings
from providers.base import MarketDataProvider


@lru_cache(maxsize=1)
def _vnstock_types():
    import vnstock
    from vnstock import Market, Reference

    if settings.vnstock_api_key:
        vnstock.login(settings.vnstock_api_key)
    return Market, Reference


class VnstockProvider(MarketDataProvider):
    """Adapter for vnstock v5; services use only the normalized provider contract."""

    source_id = "vnstock"
    data_mode = "market-provider"
    # Preserve the previous VCI normalization assumption explicitly. Verify
    # this against an entitled live response before enabling this provider.
    stock_price_multiplier = 1000.0

    def list_symbols(self) -> pd.DataFrame:
        _, reference = _vnstock_types()
        frame = reference().equity.list_by_exchange()
        if frame is None or frame.empty:
            return pd.DataFrame(columns=["symbol", "name", "exchange", "sector"])
        frame = frame.rename(columns={"organ_name": "name"})
        try:
            industry = reference().equity.list_by_industry()
            if industry is not None and not industry.empty:
                industry = industry.sort_values("icb_level").drop_duplicates("symbol", keep="last")
                frame = frame.merge(industry[["symbol", "icb_name"]], on="symbol", how="left")
                frame = frame.rename(columns={"icb_name": "sector"})
        except (KeyError, AttributeError, ValueError):
            frame["sector"] = None
        columns = [column for column in ("symbol", "name", "exchange", "sector") if column in frame]
        return frame[columns].drop_duplicates("symbol").reset_index(drop=True)

    def get_quote_snapshot(self, symbols: list[str]) -> pd.DataFrame:
        if not symbols:
            return pd.DataFrame()
        market, _ = _vnstock_types()
        return market().quote([symbol.upper() for symbol in symbols])

    def get_ohlcv(self, symbol: str, start: date, end: date, interval: str = "1D") -> pd.DataFrame:
        if interval != "1D":
            raise ValueError("vnstock adapter currently supports daily bars only")
        market, _ = _vnstock_types()
        return market().equity(symbol.upper()).ohlcv(
            start=start.isoformat(), end=end.isoformat(), interval=interval, source="vci"
        )

    def get_index_snapshot(self) -> pd.DataFrame:
        market, _ = _vnstock_types()
        frames = []
        for symbol in ("VNINDEX", "HNXINDEX", "UPCOMINDEX"):
            try:
                frame = market().index(symbol).ohlcv(limit=1)
                if frame is not None and not frame.empty:
                    frame = frame.copy()
                    frame["symbol"] = symbol
                    frames.append(frame.tail(1))
            except Exception:
                continue
        return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()

    def get_index_history(self, symbol: str, start: date, end: date) -> pd.DataFrame:
        market, _ = _vnstock_types()
        return market().index(symbol.upper()).ohlcv(start=start.isoformat(), end=end.isoformat())

    def get_company_profile(self, symbol: str) -> dict[str, str | None]:
        frame = self.list_symbols()
        if frame.empty:
            return {"symbol": symbol.upper(), "name": None, "exchange": None}
        match = frame.loc[frame["symbol"].astype(str).str.upper() == symbol.upper()]
        if match.empty:
            return {"symbol": symbol.upper(), "name": None, "exchange": None}
        row = match.iloc[0]
        return {
            "symbol": symbol.upper(),
            "name": str(row.get("name")) if pd.notna(row.get("name")) else None,
            "exchange": str(row.get("exchange")) if pd.notna(row.get("exchange")) else None,
        }
