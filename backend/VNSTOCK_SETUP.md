# Vnstock Community for local research

FinSight can use Vnstock Community for a private, local run. The default and public deployment still use labeled CSV demo data. Community is free but needs a Vnstock API key; an unregistered Guest session cannot call the adapter's `list_by_exchange()` route. Vnstock does not grant rights to store or publish its upstream sources' data.

## One-time setup

1. Create a free Community account and get an API key at <https://vnstocks.com/account#api-key>. Do not put the key in Git or chat.
2. Copy the root `.env.example` to `.env`, then set `VNSTOCK_API_KEY=<your key>`, `MARKET_PROVIDER=vnstock`, and `INSTALL_VNSTOCK=true`. The `.env` file is ignored by Git.
3. Start Docker Desktop, then run `docker compose up --build -d` from the repo root. Check `docker compose ps` and `docker compose logs worker --tail 40`.
4. Open `http://localhost:8000/api/v1/market/data-status` and `http://localhost:3000`. The source must be `vnstock`, not `csv-demo`.

For a Python-only setup, install both `requirements.txt` and `requirements-vnstock.txt` into `backend/.venv` and set the same environment variables. The optional package is pinned at 5.2.1. It is not installed in the public image by default.

The Compose services share the `vnstock_auth` volume so the Vnstock device identity survives container rebuilds and both services use the same identity. Community permits one device. If Docker's data store is reset, the volume and device identity are lost; remove the old Docker/Linux device in your Vnstock account before registering the new one. `VNSTOCK_SYMBOLS=ALL` imports the active HOSE, HNX and UPCOM equity directory; `DELISTED` entries are excluded. A comma-separated list still limits the universe for development. The worker then fills two years of daily history in restartable batches of 50 symbols, starting the next batch within one minute after the preceding batch. Each batch records an attempt checkpoint and reserves 20% of the account's reported minute, hour, day and month limits. `VNSTOCK_REQUEST_DELAY_SECONDS` defaults to 6 between provider calls, so the first full backfill takes hours. Watch `symbolCoverage` at `/api/v1/market/data-status`: `listed` is the directory size, `withHistory` counts symbols with any price, and `currentToIndexDate` counts symbols with a bar on or after the latest VN-Index date. The Community tier permits up to about eight years of daily history, subject to current policy. VCI equity OHLCV is already adjusted for corporate actions and quoted in thousands of VND; FinSight stores it in VND. Index OHLCV stays in index points. Any tier-truncated history is rejected rather than stored as complete.

Data methods: `Reference().equity.list_by_exchange()` for the ticker directory; `Market().equity(symbol).ohlcv(source="vci")` for adjusted daily stock history; `Market().index(symbol).ohlcv()` for index history. This is end-of-day history, not a real-time exchange feed. If the provider fails, FinSight must show an error or stale state, never silently use synthetic prices.
