# FinSight Fullstack Audit — F0

**Reviewed:** 2026-11-06  
**Purpose:** establish the actual implementation baseline before F1–F7. This audit does not treat existing uncommitted work as disposable.

## Data and page map

| Consumer | Current path | Existing source/data | Findings for implementation |
|---|---|---|---|
| Dashboard | `frontend/app/dashboard/page.tsx` → `frontend/lib/api.ts` → v1 market endpoints and `/api/v1/news` | PostgreSQL snapshots/bars/articles; worker ingestion | Most market panels already fetch APIs. Some dashboard widgets still use legacy routes or local defaults; provenance is not uniform across every panel. |
| Market screener | `frontend/app/market/page.tsx` → `getScreenerData()` → `GET /api/v1/stocks` | `symbols` + latest/previous `price_bars`; provider worker | API client currently requests a fixed 200 rows sorted by gainers. Search, exchange/sector/change filters and sort are client-side. No URL state, Vietnamese accent-insensitive search or pagination in the page. Screener response omits fundamentals and a uniform source per row is not represented in the frontend type. |
| News | `frontend/app/news/page.tsx` → `getNewsIntelligence()` → `GET /api/v1/news?limit=50` | RSS from VnExpress/VnEconomy → `NewsArticle` + `NewsSymbol`; keyword sentiment | UI fetches one page and filters source/sentiment client-side. No URL query filters, category/symbol search contract, T+1/T+5 event data or per-article data method in the API client. News page labels the analysis as AI although ingestion uses keyword sentiment. |
| Stock detail | `frontend/app/stock/[symbol]/page.tsx` → quote/profile/history helpers → `GET /api/v1/stocks/{symbol}` and `/history` | `Symbol`, `PriceBar`, optional `Fundamental` | Dynamic route and chart already exist. Indicators and event pins are not wired into this page. Unknown symbols surface through fetch errors rather than a verified Next.js not-found flow. Watchlist has account sync when authenticated and localStorage otherwise. |
| Search/navigation | top navigation and market page → legacy and v1 helper functions | `Symbol` directory and older service routes | API client contains both legacy endpoints and v1 endpoints, with snake_case and camelCase mapping. F3 should preserve active callers while consolidating page calls. |
| Deployment/demo | Docker Compose: db, Redis, backend, worker, frontend | Compose defaults to `MARKET_PROVIDER=csv`; checked-in CSV is synthetic | CSV is appropriate for public demo only with a visible synthetic label. Render configuration and runtime defaults must be checked in F1/F7 so public deployment cannot select vnstock accidentally. |

## Existing backend building blocks

- Provider interface and factory exist for `vnstock` and `csv`; no DNSE/SSI provider exists.
- Price ingestion upserts by `(symbol, trade_date)` and tags source as `csv-demo` or `vnstock`. It currently infers provider source from the concrete class name.
- Tables already exist for symbols, price/index bars, fundamentals, news articles and news-symbol links. No event-study/result model exists.
- News ingestion normalizes RSS items, deduplicates by URL/title hash, links symbols and assigns category/sentiment. The feed client caches in process; operational feed status/retention rights are not represented.
- Market and stock v1 endpoints already return some `source`, `asOf`, and `dataMode` fields. Aggregate responses can say `market-provider` when a result mixes modes; not every endpoint carries source metadata.
- Stock history and indicators are DB-backed; API client types currently drop history provenance and some profile fields.

## Constraints and implementation implications

1. F1 tests vnstock first because it is the configured existing adapter. Public deployment remains on CSV synthetic unless the current package/data terms clearly permit public display and the deployment installation works.
2. Never change provider failure into a CSV response. Preserve an explicit provider error/empty/stale state.
3. F2 should use an explicit provider identity/source value rather than checking `provider.__class__.__name__` at ingest time.
4. F3 needs one agreed API mapping in `frontend/lib/api.ts`; current consumers must be inventoried before legacy routes are removed.
5. F4/F5 are net-new behavior: event return and abnormal return are not currently stored or served. No frontend reaction figures should be fabricated from synthetic prices.
6. Keep the current symbol universe and actual provider coverage explicit. Backend seed files cover a small set of symbols and must not be silently described as the frontend heatmap's 84 symbols.
7. Existing working-tree edits predate this implementation pass. Do not reset, revert, or overwrite unrelated changes; review diffs before touching modified files.

## Stage gates

- **F0 complete:** this endpoint/page/source map exists and implementation gaps above are recorded.
- **F1 gate:** provider installation, representative market coverage, history shape, deployment viability and public-display permission are documented. If permission is unclear, select CSV for public deployment and keep vnstock development-only.
- **F2–F7:** follow `IMPLEMENTATION_PLAN.md`; each stage must meet its gate and report status before advancing.
