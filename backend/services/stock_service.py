from datetime import datetime, timedelta, time as dtime
from typing import Any, Iterable

import pandas as pd

try:
    from zoneinfo import ZoneInfo
    _VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
except Exception:  # pragma: no cover - fallback if tzdata missing
    _VN_TZ = None

from core.config import settings
from providers.factory import get_market_provider
from services.news_service import fetch_news_items


class MarketCache:
    def __init__(self, ttl_seconds: int = 300):
        self.data = None
        self.timestamp = None
        self.ttl = ttl_seconds

    def get(self):
        if self.data is None or self.timestamp is None:
            return None
        if datetime.now() - self.timestamp > timedelta(seconds=self.ttl):
            return None
        return self.data

    def set(self, data):
        self.data = data
        self.timestamp = datetime.now()


# Short TTL so polling clients see near-real-time prices during market hours.
# vnstock free-tier batches ~60 symbols in 1 call, so 15s is well within rate limits.
top_movers_cache = MarketCache(ttl_seconds=15)
market_snapshot_cache = MarketCache(ttl_seconds=15)
indices_cache = MarketCache(ttl_seconds=15)
universe_cache = MarketCache(ttl_seconds=24 * 60 * 60)
symbol_directory_cache = MarketCache(ttl_seconds=24 * 60 * 60)

# Per-symbol OHLCV history cache: keyed by "SYMBOL:days", 15-minute TTL
_HISTORY_CACHE: dict[str, tuple[datetime, "pd.DataFrame"]] = {}
_HISTORY_TTL = timedelta(minutes=15)

def get_symbol_directory() -> pd.DataFrame:
    cached = symbol_directory_cache.get()
    if cached is not None:
        return cached.copy()
    frame = get_market_provider().list_symbols()
    if frame is None or frame.empty:
        raise RuntimeError("Configured provider returned no symbols")
    frame = frame.copy()
    if "name" not in frame and "organ_name" in frame:
        frame = frame.rename(columns={"organ_name": "name"})
    if "sector" not in frame:
        frame["sector"] = None
    symbol_directory_cache.set(frame)
    return frame.copy()


def get_symbol_universe() -> tuple[list[str], dict[str, str]]:
    """Load the complete listed universe once per day.

    Price boards are still fetched in bounded batches, but the symbol source is
    Listing rather than a hand-maintained watchlist. This keeps the screener
    honest when new listings appear.
    """
    cached = universe_cache.get()
    if cached:
        return cached
    frame = get_symbol_directory()
    if frame is None or frame.empty:
        raise RuntimeError("vnstock Listing returned no symbols")
    symbol_col = next((c for c in ["symbol", "ticker", "code"] if c in frame.columns), None)
    exchange_col = next((c for c in ["exchange", "com_type", "type"] if c in frame.columns), None)
    if not symbol_col:
        raise RuntimeError("Listing response has no symbol column")
    symbols = frame[symbol_col].astype(str).str.upper().str.strip()
    symbols = [s for s in symbols.tolist() if s.isalpha() and 2 <= len(s) <= 5]
    exchanges = {}
    if exchange_col:
        exchanges = {
            str(row[symbol_col]).upper().strip(): str(row[exchange_col]).upper()
            for _, row in frame.iterrows()
            if pd.notna(row.get(exchange_col))
        }
    result = (list(dict.fromkeys(symbols)), exchanges)
    universe_cache.set(result)
    return result

SECTOR_MAP = {
    "VCB": "Ngân hàng & Tài chính",
    "BID": "Ngân hàng & Tài chính",
    "CTG": "Ngân hàng & Tài chính",
    "TCB": "Ngân hàng & Tài chính",
    "MBB": "Ngân hàng & Tài chính",
    "ACB": "Ngân hàng & Tài chính",
    "VPB": "Ngân hàng & Tài chính",
    "HDB": "Ngân hàng & Tài chính",
    "SSB": "Ngân hàng & Tài chính",
    "STB": "Ngân hàng & Tài chính",
    "LPB": "Ngân hàng & Tài chính",
    "TPB": "Ngân hàng & Tài chính",
    "SSI": "Chứng khoán",
    "VND": "Chứng khoán",
    "HCM": "Chứng khoán",
    "VCI": "Chứng khoán",
    "BSI": "Chứng khoán",
    "ORS": "Chứng khoán",
    "DXS": "Bất động sản",
    "DXG": "Bất động sản",
    "PDR": "Bất động sản",
    "NLG": "Bất động sản",
    "KDH": "Bất động sản",
    "VHM": "Bất động sản",
    "NVL": "Bất động sản",
    "VRE": "Bất động sản",
    "BCM": "Bất động sản",
    "KBC": "Công nghiệp & Logistics",
    "GEX": "Công nghiệp & Logistics",
    "VGC": "Công nghiệp & Logistics",
    "DGC": "Công nghiệp & Logistics",
    "HPG": "Vật liệu & Thép",
    "HSG": "Vật liệu & Thép",
    "NKG": "Vật liệu & Thép",
    "MSN": "Tiêu dùng & Bán lẻ",
    "MWG": "Tiêu dùng & Bán lẻ",
    "FRT": "Tiêu dùng & Bán lẻ",
    "PNJ": "Tiêu dùng & Bán lẻ",
    "DGW": "Tiêu dùng & Bán lẻ",
    "SAB": "Tiêu dùng & Bán lẻ",
    "GVR": "Tiêu dùng & Bán lẻ",
    "FPT": "Công nghệ",
    "CMG": "Công nghệ",
    "ELC": "Công nghệ",
    "VGI": "Công nghệ",
    "GAS": "Năng lượng & Dầu khí",
    "PVD": "Năng lượng & Dầu khí",
    "PVS": "Năng lượng & Dầu khí",
    "PLX": "Năng lượng & Dầu khí",
    "POW": "Tiện ích & Điện",
    "REE": "Tiện ích & Điện",
    "GMD": "Vận tải & Logistics",
    "VSC": "Vận tải & Logistics",
    "HAH": "Vận tải & Logistics",
    "AST": "Vận tải & Logistics",
}

DEMO_MOVER_SEED = [
    {"symbol": "VCB", "exchange": "HOSE", "current_price": 61700,  "price_change": 100,   "percent_change": 0.16,  "volume": 4869000},
    {"symbol": "FPT", "exchange": "HOSE", "current_price": 71500,  "price_change": -100,  "percent_change": -0.14, "volume": 2100000},
    {"symbol": "HPG", "exchange": "HOSE", "current_price": 23600,  "price_change": -50,   "percent_change": -0.21, "volume": 12000000},
    {"symbol": "MWG", "exchange": "HOSE", "current_price": 55000,  "price_change": 500,   "percent_change": 0.92,  "volume": 2800000},
    {"symbol": "SSI", "exchange": "HOSE", "current_price": 28500,  "price_change": 300,   "percent_change": 1.06,  "volume": 5400000},
    {"symbol": "TCB", "exchange": "HOSE", "current_price": 18200,  "price_change": -200,  "percent_change": -1.09, "volume": 9800000},
    {"symbol": "PDR", "exchange": "HOSE", "current_price": 11500,  "price_change": -300,  "percent_change": -2.54, "volume": 3200000},
    {"symbol": "NVL", "exchange": "HOSE", "current_price": 10800,  "price_change": -250,  "percent_change": -2.26, "volume": 4100000},
    {"symbol": "GEX", "exchange": "HOSE", "current_price": 14700,  "price_change": 350,   "percent_change": 2.44,  "volume": 7300000},
    {"symbol": "HSG", "exchange": "HOSE", "current_price": 16500,  "price_change": 200,   "percent_change": 1.23,  "volume": 6100000},
]


def refresh_market_snapshot() -> dict:
    """Refresh the cached full-market snapshot for background workers."""
    market_snapshot_cache.data = None
    market_snapshot_cache.timestamp = None
    return _get_market_snapshot()


def _get_market_snapshot():
    cached = market_snapshot_cache.get()
    if cached:
        return cached

    try:
        provider = get_market_provider()
        all_stocks = []

        symbols, exchange_map = get_symbol_universe()
        # Keep each request bounded; the complete universe is cached for a day.
        batch_size = 60
        for i in range(0, len(symbols), batch_size):
            batch = symbols[i:i + batch_size]
            try:
                df = provider.get_quote_snapshot(batch)
                if df is not None and not df.empty:
                    all_stocks.append(df)
            except Exception:
                continue

        if not all_stocks:
            return {"error": "vnstock price board returned no market data"}

        combined_df = pd.concat(all_stocks, ignore_index=True)
        directory = get_symbol_directory()
        if "symbol" in directory.columns:
            directory["symbol"] = directory["symbol"].astype(str).str.upper()
            sectors = directory.drop_duplicates("symbol").set_index("symbol").get("sector", pd.Series(dtype=object))
            exchange_by_symbol = directory.drop_duplicates("symbol").set_index("symbol").get("exchange", pd.Series(dtype=object))
            codes = combined_df["symbol"].astype(str).str.upper()
            combined_df["sector"] = codes.map(sectors)
            if "exchange" not in combined_df:
                combined_df["exchange"] = codes.map(exchange_by_symbol)
        combined_df["percent_change_num"] = _coerce_numeric_series(combined_df, ["percent_change"])
        combined_df["price_change_num"] = _coerce_numeric_series(combined_df, ["price_change", "change"])
        combined_df["price_num"] = _coerce_numeric_series(combined_df, ["close_price", "match_price", "price"])
        combined_df["volume_num"] = _coerce_numeric_series(
            combined_df,
            ["volume_accumulated", "volume_last", "match_volume", "volume"],
        )
        combined_df = combined_df.dropna(subset=["percent_change_num"])

        if combined_df.empty:
            return {"error": "vnstock price board returned no valid prices"}

        snapshot = {
            "updated_at": datetime.now().isoformat(),
            "df": combined_df,
        }
        market_snapshot_cache.set(snapshot)
        return snapshot
    except Exception:
        return {"error": "Unable to load market snapshot from vnstock"}


def get_stock_history(symbol: str, days: int = 365):
    cache_key = f"{symbol.upper()}:{days}"
    cached_entry = _HISTORY_CACHE.get(cache_key)
    if cached_entry is not None:
        ts, df = cached_entry
        if datetime.now() - ts < _HISTORY_TTL:
            return df.copy()

    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=days)
    df = get_market_provider().get_ohlcv(
        symbol.upper(), start_dt.date(), end_dt.date(), interval="1D"
    )
    if df is not None and not df.empty:
        _HISTORY_CACHE[cache_key] = (datetime.now(), df)
    return df


def _price_scale_factor(df: pd.DataFrame, price_col: str) -> float:
    """VCI/Quote history returns prices in thousands of VND (e.g. 56.24 = 56,240 VND).
    Detect by checking if the median close is < 1,000 and multiply by 1000."""
    sample = pd.to_numeric(df[price_col], errors="coerce").dropna()
    if sample.empty:
        return 1.0
    return 1000.0 if sample.median() < 1000 else 1.0


def get_stock_ohlcv(symbol: str, days: int = 180) -> dict:
    """Return OHLCV as a list for frontend charting."""
    symbol = symbol.upper()
    try:
        df = get_stock_history(symbol, days=days)
        if df is None or df.empty:
            return {"error": f"No history for {symbol}", "candles": []}

        price_col = next((c for c in ["close", "Close", "close_price"] if c in df.columns), None)
        open_col = next((c for c in ["open", "Open", "open_price"] if c in df.columns), None)
        high_col = next((c for c in ["high", "High", "high_price"] if c in df.columns), None)
        low_col = next((c for c in ["low", "Low", "low_price"] if c in df.columns), None)
        vol_col = next((c for c in ["volume", "Volume"] if c in df.columns), None)
        time_col = next((c for c in ["time", "date", "Date", "timestamp"] if c in df.columns), None)

        if not price_col:
            return {"error": "No price column found", "candles": []}

        scale = _price_scale_factor(df, price_col)

        candles = []
        for _, row in df.iterrows():
            close = _safe_float(row.get(price_col))
            if close is None:
                continue
            close = round(close * scale, 0)
            t = _normalize_timestamp(row.get(time_col)) if time_col else None
            open_ = _safe_float(row.get(open_col)) if open_col else None
            high_ = _safe_float(row.get(high_col)) if high_col else None
            low_ = _safe_float(row.get(low_col)) if low_col else None
            candles.append({
                "time": t,
                "open": round(open_ * scale, 0) if open_ is not None else close,
                "high": round(high_ * scale, 0) if high_ is not None else close,
                "low": round(low_ * scale, 0) if low_ is not None else close,
                "close": close,
                "volume": _safe_int(row.get(vol_col)) if vol_col else None,
            })

        return {
            "symbol": symbol,
            "days": days,
            "candles": candles,
            "updated_at": datetime.now().isoformat(),
        }
    except Exception as e:
        return {"error": str(e), "candles": []}


LISTING_CACHE: dict | None = None
LISTING_CACHE_TS: datetime | None = None


def get_stock_profile(symbol: str) -> dict:
    """Return company_name, sector, and 52-week high/low for a symbol."""
    symbol = symbol.upper()
    global LISTING_CACHE, LISTING_CACHE_TS

    company_name = None
    try:
        now = datetime.now()
        if LISTING_CACHE is None or LISTING_CACHE_TS is None or (now - LISTING_CACHE_TS).seconds > 3600:
            df_list = get_market_provider().list_symbols()
            if df_list is not None and not df_list.empty:
                LISTING_CACHE = df_list
                LISTING_CACHE_TS = now

        if LISTING_CACHE is not None:
            df_l = LISTING_CACHE
            sym_col = "symbol" if "symbol" in df_l.columns else None
            name_col = next((c for c in ["organ_name", "company_name", "name"] if c in df_l.columns), None)
            if sym_col and name_col:
                match = df_l[df_l[sym_col].astype(str).str.upper() == symbol]
                if not match.empty:
                    raw = str(match.iloc[0][name_col])
                    if raw not in ("nan", "None", "NaN", ""):
                        company_name = raw
    except Exception:
        pass

    sector = None
    try:
        directory = get_symbol_directory()
        match = directory.loc[directory["symbol"].astype(str).str.upper() == symbol]
        if not match.empty and pd.notna(match.iloc[0].get("sector")):
            sector = str(match.iloc[0].get("sector"))
    except Exception:
        pass

    week52_high = None
    week52_low = None
    try:
        df = get_stock_history(symbol, days=365)
        if df is not None and not df.empty:
            high_col = next((c for c in ["high", "High", "high_price"] if c in df.columns), None)
            low_col = next((c for c in ["low", "Low", "low_price"] if c in df.columns), None)
            close_col = next((c for c in ["close", "Close", "close_price"] if c in df.columns), None)

            ref_col = close_col or high_col or low_col
            scale = _price_scale_factor(df, ref_col) if ref_col else 1.0

            if high_col:
                highs = pd.to_numeric(df[high_col], errors="coerce").dropna()
                if not highs.empty:
                    week52_high = round(float(highs.max()) * scale, 0)
            if week52_high is None and close_col:
                closes = pd.to_numeric(df[close_col], errors="coerce").dropna()
                if not closes.empty:
                    week52_high = round(float(closes.max()) * scale, 0)

            if low_col:
                lows = pd.to_numeric(df[low_col], errors="coerce").dropna()
                if not lows.empty:
                    week52_low = round(float(lows.min()) * scale, 0)
            if week52_low is None and close_col:
                closes = pd.to_numeric(df[close_col], errors="coerce").dropna()
                if not closes.empty:
                    week52_low = round(float(closes.min()) * scale, 0)
    except Exception:
        pass

    return {
        "symbol": symbol,
        "company_name": company_name,
        "sector": sector,
        "week52_high": week52_high,
        "week52_low": week52_low,
    }


def get_search_results(query: str, limit: int = 10) -> dict:
    """Search stock symbols by ticker or company name."""
    global LISTING_CACHE, LISTING_CACHE_TS
    query = query.strip().upper()
    if not query:
        return {"results": []}

    try:
        now = datetime.now()
        if LISTING_CACHE is None or LISTING_CACHE_TS is None or (now - LISTING_CACHE_TS).seconds > 3600:
            df = get_market_provider().list_symbols()
            if df is not None and not df.empty:
                LISTING_CACHE = df
                LISTING_CACHE_TS = now

        if LISTING_CACHE is not None:
            df = LISTING_CACHE
            sym_col = "symbol" if "symbol" in df.columns else None
            name_col = next((c for c in ["organ_name", "company_name", "name"] if c in df.columns), None)
            exch_col = "exchange" if "exchange" in df.columns else None

            if sym_col:
                # Only real equity symbols: 3 alpha chars, valid exchanges
                valid_exch = {"HOSE", "HNX", "UPCOM"}
                equity_mask = (
                    df[sym_col].astype(str).str.match(r'^[A-Z]{3}$', na=False)
                )
                if exch_col:
                    equity_mask = equity_mask & df[exch_col].isin(valid_exch)
                df_eq = df[equity_mask]

                mask = df_eq[sym_col].astype(str).str.upper().str.startswith(query)
                if name_col:
                    mask = mask | df_eq[name_col].astype(str).str.upper().str.contains(query, na=False)
                hits = df_eq[mask].head(limit)
                results = []
                for _, row in hits.iterrows():
                    name_raw = str(row.get(name_col, "")) if name_col else ""
                    results.append({
                        "symbol": str(row.get(sym_col, "")).upper(),
                        "name": "" if name_raw in ("nan", "None", "NaN") else name_raw,
                        "exchange": str(row.get(exch_col, "HOSE")) if exch_col else "HOSE",
                    })
                return {"results": results}
    except Exception:
        pass

    return {"results": []}


def convert_numpy_to_python(value):
    """Convert numpy types to Python native types for JSON serialization"""
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _safe_float(value: Any):
    value = convert_numpy_to_python(value)
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None


def _safe_int(value: Any):
    value = convert_numpy_to_python(value)
    try:
        if value is None or pd.isna(value):
            return None
        return int(value)
    except Exception:
        return None


def _normalize_timestamp(value: Any):
    value = convert_numpy_to_python(value)
    if value is None:
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    try:
        if isinstance(value, (int, float)) and value > 10_000_000_000:
            return datetime.fromtimestamp(value / 1000).isoformat()
    except Exception:
        pass
    return str(value)


def _get_first_existing(row: pd.Series, candidates: Iterable[str]):
    for column in candidates:
        if column in row.index and pd.notna(row[column]):
            return row[column]
    return None


def _coerce_numeric_series(df: pd.DataFrame, candidates: list[str]) -> pd.Series:
    for column in candidates:
        if column in df.columns:
            return pd.to_numeric(df[column], errors="coerce")
    return pd.Series([None] * len(df), index=df.index, dtype="float64")


def _find_first_numeric(row: pd.Series, candidates: Iterable[str]):
    for column in candidates:
        if column in row.index:
            value = _safe_float(row.get(column))
            if value is not None:
                return value
    return None


def _extract_close_from_history(df: pd.DataFrame) -> tuple[float | None, float | None]:
    if df is None or df.empty:
        return None, None

    price_col = next((c for c in ["close", "Close", "close_price", "price"] if c in df.columns), None)
    if not price_col:
        return None, None

    close_series = pd.to_numeric(df[price_col], errors="coerce").dropna()
    if close_series.empty:
        return None, None

    scale = 1000.0 if close_series.median() < 1000 else 1.0
    last = float(close_series.iloc[-1]) * scale
    prev = float(close_series.iloc[-2]) * scale if len(close_series) > 1 else None
    return last, prev


def get_quote(symbol: str) -> dict:
    """Get realtime stock quote with proper JSON serialization"""
    symbol = symbol.upper()
    try:
        df = get_market_provider().get_quote_snapshot([symbol])
        if df is None or df.empty:
            return {"error": f"Symbol {symbol} not found"}

        row = df.iloc[0]
        timestamp = _normalize_timestamp(_get_first_existing(row, ["time", "timestamp", "updated_at", "received_time"]))

        current_price = _find_first_numeric(row, ["current_price", "match_price", "close_price", "price", "last_price"])
        price_change = _find_first_numeric(row, ["price_change", "change", "match_price_change"])
        percent_change = _find_first_numeric(row, ["percent_change", "price_change_pct", "change_pct"])
        volume = _safe_int(_get_first_existing(row, ["volume_accumulated", "volume_last", "match_volume", "volume"]))

        # Some vnstock feeds expose only current price or only the change fields.
        # When any of the realtime fields are missing, derive them from history
        # so we do not surface stale or inconsistent numbers.
        if current_price is None or price_change is None or percent_change is None:
            try:
                hist = get_stock_history(symbol, days=7)
                last_close, prev_close = _extract_close_from_history(hist)
                if current_price is None:
                    current_price = last_close
                if last_close is not None and prev_close not in (None, 0):
                    derived_change = last_close - prev_close
                    derived_pct = (derived_change / prev_close) * 100
                    if price_change is None:
                        price_change = derived_change
                    if percent_change is None:
                        percent_change = derived_pct
            except Exception:
                pass

        if current_price is None:
            return {"error": f"Symbol {symbol} not found"}

        return {
            "symbol": str(convert_numpy_to_python(row.get("symbol", symbol))).upper(),
            "exchange": convert_numpy_to_python(row.get("exchange")),
            "current_price": round(float(current_price), 2),
            "price_change": round(float(price_change), 2) if price_change is not None else None,
            "percent_change": round(float(percent_change), 2) if percent_change is not None else None,
            "volume": volume,
            "updated_at": timestamp,
        }

    except Exception as e:
        return {"error": str(e)}


def get_top_movers(limit: int = 10) -> dict:
    """Get top gainers and losers from the full Vietnam equity universe."""
    try:
        cached = top_movers_cache.get()
        if cached:
            return cached

        snapshot = _get_market_snapshot()
        if "error" in snapshot:
            return snapshot

        combined_df = snapshot["df"]
        if combined_df.empty:
            return {"error": "No valid market movers data available"}

        gainers_df = combined_df.sort_values("percent_change_num", ascending=False).head(limit)
        losers_df = combined_df.sort_values("percent_change_num", ascending=True).head(limit)

        result = {
            "updated_at": snapshot["updated_at"],
            "gainers": [],
            "losers": [],
        }

        def format_stock(row):
            return {
                "symbol": str(convert_numpy_to_python(row.get("symbol", ""))).upper(),
                "exchange": convert_numpy_to_python(row.get("exchange")),
                "current_price": round(float(row["price_num"]), 2) if pd.notna(row.get("price_num")) else None,
                "price_change": round(float(row["price_change_num"]), 2) if pd.notna(row.get("price_change_num")) else None,
                "percent_change": round(float(row["percent_change_num"]), 2) if pd.notna(row.get("percent_change_num")) else None,
                "volume": _safe_int(row.get("volume_num")),
            }

        result["gainers"] = [format_stock(row) for _, row in gainers_df.iterrows()]
        result["losers"] = [format_stock(row) for _, row in losers_df.iterrows()]

        top_movers_cache.set(result)

        return result

    except Exception as e:
        return {"error": str(e), "gainers": [], "losers": []}


def get_market_breadth() -> dict:
    try:
        snapshot = _get_market_snapshot()
        if "error" in snapshot:
            return snapshot

        df = snapshot["df"]
        total = len(df)
        if total == 0:
            return {"error": "No market breadth data available"}

        advancers = int((df["percent_change_num"] > 0).sum())
        decliners = int((df["percent_change_num"] < 0).sum())
        unchanged = int((df["percent_change_num"] == 0).sum())
        ratio = round(advancers / max(decliners, 1), 2)
        sentiment = "RISK-ON" if advancers >= decliners else "RISK-OFF"

        return {
            "updated_at": snapshot["updated_at"],
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "sentiment": sentiment,
            "status": f"Breadth ratio: {ratio}:1 advancers-to-decliners",
        }
    except Exception as e:
        return {"error": str(e), "advancers": 0, "decliners": 0, "unchanged": 0}


def get_most_active(limit: int = 10) -> dict:
    try:
        snapshot = _get_market_snapshot()
        if "error" in snapshot:
            return snapshot

        df = snapshot["df"].sort_values("volume_num", ascending=False).head(limit)
        return {
            "updated_at": snapshot["updated_at"],
            "stocks": [
                {
                    "symbol": str(convert_numpy_to_python(row.get("symbol", ""))).upper(),
                    "exchange": convert_numpy_to_python(row.get("exchange")),
                    "current_price": round(float(row["price_num"]), 2) if pd.notna(row.get("price_num")) else None,
                    "price_change": round(float(row["price_change_num"]), 2) if pd.notna(row.get("price_change_num")) else None,
                    "percent_change": round(float(row["percent_change_num"]), 2) if pd.notna(row.get("percent_change_num")) else None,
                    "volume": _safe_int(row.get("volume_num")),
                }
                for _, row in df.iterrows()
            ],
        }
    except Exception as e:
        return {"error": str(e), "stocks": []}


def get_screener_data() -> dict:
    """Return full curated universe with price, change, volume, and sector for the screener."""
    try:
        snapshot = _get_market_snapshot()
        if "error" in snapshot:
            return snapshot

        df = snapshot["df"].copy()
        if "sector" not in df:
            df["sector"] = None

        stocks = []
        for _, row in df.iterrows():
            sym = str(convert_numpy_to_python(row.get("symbol", ""))).upper()
            if not sym:
                continue
            price = row.get("price_num")
            pct = row.get("percent_change_num")
            change = row.get("price_change_num")
            vol = row.get("volume_num")
            stocks.append({
                "symbol": sym,
                "exchange": str(convert_numpy_to_python(row.get("exchange", "HOSE"))),
                "sector": str(row["sector"]) if pd.notna(row.get("sector")) else None,
                "current_price": round(float(price), 2) if pd.notna(price) else None,
                "price_change": round(float(change), 2) if pd.notna(change) else None,
                "percent_change": round(float(pct), 2) if pd.notna(pct) else None,
                "volume": _safe_int(vol) if pd.notna(vol) else None,
            })

        return {
            "updated_at": snapshot["updated_at"],
            "count": len(stocks),
            "stocks": stocks,
        }
    except Exception as e:
        return {"error": str(e), "stocks": []}


def get_sector_performance(limit: int = 6) -> dict:
    try:
        snapshot = _get_market_snapshot()
        if "error" in snapshot:
            return snapshot

        df = snapshot["df"].copy()
        if "sector" not in df:
            df["sector"] = None
        df = df.dropna(subset=["sector"])
        grouped = (
            df.groupby("sector", dropna=False)["percent_change_num"]
            .agg(["mean", "count"])
            .reset_index()
            .sort_values("mean", ascending=False)
        )

        leading = grouped.head(limit)
        weak = grouped.sort_values("mean", ascending=True).head(limit)

        def to_item(row):
            return {
                "name": row["sector"],
                "percent_change": round(float(row["mean"]), 2),
                "stocks": int(row["count"]),
            }

        return {
            "updated_at": snapshot["updated_at"],
            "leading": [to_item(row) for _, row in leading.iterrows()],
            "weak": [to_item(row) for _, row in weak.iterrows()],
        }
    except Exception as e:
        return {"error": str(e), "leading": [], "weak": []}


def _get_last_trading_date() -> datetime:
    now = datetime.now()
    weekday = now.weekday()  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    # Saturday -> Friday
    if weekday == 5:
        return now - timedelta(days=1)
    # Sunday -> Friday
    elif weekday == 6:
        return now - timedelta(days=2)
    # Monday before 9:00 AM -> Friday
    elif weekday == 0 and now.hour < 9:
        return now - timedelta(days=3)
    return now


_commentary_cache = MarketCache(ttl_seconds=600)
_news_intelligence_cache = MarketCache(ttl_seconds=600)


def get_market_commentary() -> dict:
    cached = _commentary_cache.get()
    if cached:
        return cached

    breadth = get_market_breadth()
    movers = get_top_movers(limit=5)
    sectors = get_sector_performance(limit=3)

    if "error" in breadth or "error" in movers or "error" in sectors:
        return {"error": "Unable to build market commentary"}

    top_gainers = movers["gainers"][:3]
    top_losers = movers["losers"][:3]
    leading = sectors["leading"][:3]
    weak = sectors["weak"][:3]

    last_trading_date = _get_last_trading_date()

    # Feed real data into AI for actual commentary
    market_data = {
        "breadth": {
            "advancers": breadth["advancers"],
            "decliners": breadth["decliners"],
            "unchanged": breadth.get("unchanged", 0),
            "sentiment": breadth["sentiment"],
        },
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "leading_sectors": leading,
        "weak_sectors": weak,
        "date": last_trading_date.strftime("%Y-%m-%d"),
    }

    from services.ai_service import generate_market_commentary
    ai_result = generate_market_commentary(market_data)

    # Build fallback template as safety net
    top_gainer_names = ", ".join(item["symbol"] for item in top_gainers[:2]) if top_gainers else "các bluechip"
    top_loser_names = ", ".join(item["symbol"] for item in top_losers[:2]) if top_losers else "nhóm yếu"

    fallback_summary = (
        f"Phiên {breadth['sentiment']}: {breadth['advancers']} mã tăng, {breadth['decliners']} mã giảm. "
        f"Dẫn dắt bởi {top_gainer_names}, áp lực từ {top_loser_names}."
    )
    fallback_catalysts = [
        f"Nhóm {leading[0]['name']} dẫn đầu với {leading[0]['percent_change']:+.2f}%" if leading else "Dòng tiền tập trung nhóm vốn hóa lớn",
        f"{top_gainers[0]['symbol']} và {top_gainers[1]['symbol']} tăng mạnh" if len(top_gainers) > 1 else "Blue-chip tích cực",
        f"Độ rộng xác nhận với {breadth['advancers']} mã tăng",
    ]
    fallback_risks = [
        f"Nhóm {weak[0]['name']} còn yếu ở {weak[0]['percent_change']:+.2f}%" if weak else "Nhóm phòng thủ chưa vào cuộc",
        f"Áp lực tại {top_losers[0]['symbol']}" if top_losers else "Rủi ro từng mã riêng lẻ",
        "Thanh khoản fade có thể đảo chiều cuối phiên",
    ]

    result = {
        "updated_at": datetime.now().isoformat(),
        "headline": ai_result.get("headline", f"Phiên {breadth['sentiment']}: thị trường {'khởi sắc' if breadth['advancers'] > breadth['decliners'] else 'phân hóa'}"),
        "summary": ai_result.get("summary", fallback_summary),
        "key_drivers": ai_result.get("key_drivers", fallback_catalysts),
        "bullish_factors": ai_result.get("bullish_factors", fallback_catalysts),
        "risk_factors": ai_result.get("risk_factors", fallback_risks),
        "watch_next": ai_result.get("watch_next", ["Diễn biến cuối phiên", "Phản ứng nhóm ngân hàng"]),
        "breadth": breadth,
        "leading_sectors": leading,
        "weak_sectors": weak,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
    }
    _commentary_cache.set(result)
    return result


def get_news_intelligence() -> dict:
    cached = _news_intelligence_cache.get()
    if cached:
        return cached

    commentary = get_market_commentary()
    if "error" in commentary:
        return commentary

    top_gainer = commentary["top_gainers"][0] if commentary["top_gainers"] else {"symbol": "VNINDEX"}
    top_loser = commentary["top_losers"][0] if commentary["top_losers"] else {"symbol": "VNINDEX"}

    raw_news = fetch_news_items(limit=8)
    if not raw_news:
        result = {
            "updated_at": None,
            "items": [],
            "source": "rss",
            "data_mode": "external-feed",
            "status": "no_data",
        }
        _news_intelligence_cache.set(result)
        return result

    def classify_story(item: dict[str, Any]) -> dict[str, Any]:
        text = f"{item.get('headline', '')} {item.get('summary', '')}".lower()
        affected: list[str] = []
        market_impact = "Trung lập"

        banking_kw = ["ngân hàng", "tín dụng", "lãi suất", "sbv", "nhnn", "tiền gửi",
                      "bank", "interest rate", "credit", "deposit"]
        steel_kw   = ["thép", "hòa phát", "sắt thép", "vật liệu xây dựng", "xây dựng",
                      "steel", "iron", "construction", "materials"]
        tech_kw    = ["công nghệ", "phần mềm", "fpt", "chuyển đổi số", "ai", "chip",
                      "software", "technology", "digital"]
        retail_kw  = ["bán lẻ", "tiêu dùng", "thế giới di động", "mwg", "sức mua",
                      "retail", "consumer", "ecommerce", "shopping"]
        realestate_kw = ["bất động sản", "nhà ở", "chung cư", "địa ốc", "vinhomes",
                         "real estate", "property", "housing"]
        energy_kw  = ["dầu khí", "năng lượng", "xăng dầu", "điện", "gas",
                      "oil", "gas", "energy", "petrol"]
        securities_kw = ["chứng khoán", "cổ phiếu", "thị trường chứng khoán", "vnindex",
                         "thanh khoản thị trường"]
        transport_kw  = ["vận tải", "cảng biển", "logistic", "hàng hải",
                         "shipping", "logistics", "port"]

        if any(kw in text for kw in banking_kw):
            affected = ["VCB", "BID", "CTG", "TCB"]
            market_impact = "Tích cực cho ngân hàng"
        elif any(kw in text for kw in steel_kw):
            affected = ["HPG", "HSG", "NKG"]
            market_impact = "Nhạy cảm với chu kỳ vật liệu"
        elif any(kw in text for kw in tech_kw):
            affected = ["FPT", "CMG", "ELC"]
            market_impact = "Tích cực cho công nghệ"
        elif any(kw in text for kw in retail_kw):
            affected = ["MWG", "FRT", "PNJ", "DGW"]
            market_impact = "Tín hiệu hỗn hợp cho tiêu dùng"
        elif any(kw in text for kw in realestate_kw):
            affected = ["VHM", "VRE", "KDH", "PDR"]
            market_impact = "Áp lực lên bất động sản"
        elif any(kw in text for kw in energy_kw):
            affected = ["GAS", "PVD", "PVS", "POW"]
            market_impact = "Biến động cho nhóm năng lượng"
        elif any(kw in text for kw in securities_kw):
            affected = ["SSI", "VND", "HCM", "VCI"]
            market_impact = "Theo dõi nhóm chứng khoán"
        elif any(kw in text for kw in transport_kw):
            affected = ["GMD", "VSC", "HAH", "AST"]
            market_impact = "Tác động đến vận tải & cảng"
        else:
            affected = [top_gainer["symbol"], top_loser["symbol"]]
            market_impact = "Theo dõi toàn thị trường"

        return {
            "id": item["id"],
            "headline": item["headline"],
            "source": item["source"],
            "time": item["time"],
            "insight": item.get("summary") or commentary["summary"],
            "marketImpact": market_impact,
            "affectedTickers": affected[:4],
            "url": item.get("url"),
        }

    result = {
        "updated_at": commentary["updated_at"],
        "items": [classify_story(item) for item in raw_news],
    }
    _news_intelligence_cache.set(result)
    return result


def _vn_now() -> datetime:
    """Current time in Vietnam timezone (falls back to naive local time)."""
    if _VN_TZ is not None:
        return datetime.now(_VN_TZ)
    return datetime.now()


def get_market_status() -> dict:
    """Vietnam (HOSE/HNX) trading session status.

    Sessions (Mon-Fri):
      - Morning:   09:00 - 11:30
      - Afternoon: 13:00 - 15:00 (continuous to 14:30, ATC to ~14:45, close 15:00)
    """
    now = _vn_now()
    weekday = now.weekday()  # 0=Mon .. 6=Sun
    t = now.time()

    morning = (dtime(9, 0) <= t <= dtime(11, 30))
    afternoon = (dtime(13, 0) <= t <= dtime(15, 0))
    is_weekday = weekday < 5
    is_open = is_weekday and (morning or afternoon)

    if not is_weekday:
        session = "weekend"
    elif morning:
        session = "morning"
    elif afternoon:
        session = "afternoon"
    elif dtime(11, 30) < t < dtime(13, 0):
        session = "lunch_break"
    elif t < dtime(9, 0):
        session = "pre_open"
    else:
        session = "closed"

    return {
        "is_open": is_open,
        "session": session,
        "server_time": now.isoformat(),
        "weekday": weekday,
    }


def get_indices() -> dict:
    """Get actual index candles from the configured data provider."""
    cached = indices_cache.get()
    if cached:
        return cached
    try:
        provider = get_market_provider()
        indices_to_fetch = ["VNINDEX", "VN30", "HNX30", "UPCOMINDEX"]
        result = {"timestamp": None, "indices": []}
        def _index_label(symbol: str) -> str:
            if symbol in ["VNINDEX", "VN30"]:
                return "HOSE"
            if symbol == "HNX30":
                return "HNX"
            if symbol == "UPCOMINDEX":
                return "UPCOM"
            return "HOSE"

        for index_symbol in indices_to_fetch:
            try:
                end_date = datetime.now().date()
                df = provider.get_index_history(index_symbol, end_date - timedelta(days=7), end_date)

                if df is None or df.empty:
                    continue

                latest = df.iloc[-1]
                previous = df.iloc[-2] if len(df) > 1 else latest

                close_price = _safe_float(latest.get('close'))
                prev_close = _safe_float(previous.get('close'))
                if close_price is None or prev_close is None:
                    continue

                price_change = close_price - prev_close
                percent_change = (price_change / prev_close * 100) if prev_close else 0
                updated_at = _normalize_timestamp(_get_first_existing(latest, ["time", "timestamp", "updated_at"])) or datetime.now().isoformat()

                result["indices"].append({
                    "symbol": index_symbol,
                    "exchange": _index_label(index_symbol),
                    "points": round(close_price, 2),
                    "change": round(price_change, 2),
                    "percent_change": round(percent_change, 2),
                    "volume": _safe_int(latest.get('volume')),
                    "updated_at": updated_at,
                })
            except Exception:
                continue

        result["timestamp"] = max((item["updated_at"] for item in result["indices"]), default=None)
        final = result if result["indices"] else {"error": "Provider returned no index data", "indices": []}
        indices_cache.set(final)
        return final

    except Exception as e:
        return {"error": str(e), "indices": []}


def get_data_sources() -> dict:
    return {
        "market": {
            "indices": "Configured provider index OHLCV; defaults to vnstock v5 Market.index().ohlcv()",
            "quote": "Configured provider quote snapshot; CSV mode is synthetic demo data",
            "top_movers": "Configured provider quote snapshot over active listed symbols",
            "breadth": "Derived from provider quote snapshot",
            "sectors": "Provider ICB sector directory where available",
            "most_active": "Derived from provider quote volume",
            "search": "Configured provider symbol directory",
        },
        "history": "Configured provider daily OHLCV; vnstock v5 uses Market.equity().ohlcv()",
        "news": "RSS feeds from VnExpress and VnEconomy by default",
        "ai_enabled": bool(settings.openrouter_api_key),
        "ai": {
            "commentary": "OpenRouter if OPENROUTER_API_KEY is set, otherwise deterministic fallback",
            "chat": "OpenRouter if OPENROUTER_API_KEY is set, otherwise deterministic fallback",
        },
        "fallbacks": [
            "Cached market snapshots to reduce repeated market fetches",
            "AI response fallback when OpenRouter is unavailable",
        ],
    }
