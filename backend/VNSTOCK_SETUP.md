# Vnstock provider setup

FinSight keeps vnstock as an optional development provider behind `providers/vnstock_provider.py`. It is excluded from the public/demo container dependencies. Install the optional package locally only if your account tier permits the required features.

## Local setup

```powershell
cd backend
py -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements-vnstock.txt
```

Some reference endpoints require an entitlement beyond guest access. The current `VnstockProvider` symbol-list call returned an entitlement error without credentials. Set `VNSTOCK_API_KEY` only when you have an eligible account/key, and never commit that key. Installing the optional adapter does not grant permission to display or redistribute upstream data.

## Data source methods

- Symbol directory: `Reference().equity.list_by_exchange()` and `list_by_industry()`.
- Daily stock history: `Market().equity(symbol).ohlcv(source="vci")`.
- Index history: `Market().index(symbol).ohlcv()`.
- Batch quote board: `Market().quote(symbols)`.

The exact columns and source coverage can change upstream. All calls are isolated in the provider adapter and recorded in stored bar `source` fields. Do not treat delayed provider values as exchange realtime data.

For a reproducible local or public demo without upstream access, use `MARKET_PROVIDER=csv`; this is the default. The checked-in CSV history is synthetic demo data and is labeled `csv-demo` in storage. Do not silently fall back to it when a real provider fails.
