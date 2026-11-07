from abc import ABC, abstractmethod
from datetime import date

import pandas as pd


class MarketDataProvider(ABC):
    """Normalized market-data provider contract.

    Implementations return stock OHLC prices in the units declared by
    ``stock_price_multiplier`` and index values in index points. Daily OHLCV
    frames may include ``adjusted_close``; consumers must treat a missing
    adjusted close as unavailable for return studies.
    """

    source_id: str
    data_mode: str
    stock_price_multiplier: float = 1.0

    @abstractmethod
    def list_symbols(self) -> pd.DataFrame: ...

    @abstractmethod
    def get_quote_snapshot(self, symbols: list[str]) -> pd.DataFrame: ...

    @abstractmethod
    def get_ohlcv(self, symbol: str, start: date, end: date, interval: str = "1D") -> pd.DataFrame: ...

    @abstractmethod
    def get_index_snapshot(self) -> pd.DataFrame: ...

    @abstractmethod
    def get_index_history(self, symbol: str, start: date, end: date) -> pd.DataFrame: ...

    @abstractmethod
    def get_company_profile(self, symbol: str) -> dict[str, str | None]: ...
