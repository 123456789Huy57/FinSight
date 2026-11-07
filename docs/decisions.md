# Architecture Decisions

## Stage 1: Backend foundation

- Keep the existing FastAPI routes and response shapes so the current Next.js
  client remains compatible while the backend is migrated incrementally.
- Add async SQLAlchemy infrastructure for database-backed milestones. Existing
  synchronous vnstock integrations remain in place until provider/service work
  is addressed in the market-data milestone.
- PostgreSQL is required by the local Compose stack. Redis is optional at the
  application level and `/ready` reports whether configured dependencies are
  available.
- The initial Alembic revision is an empty baseline. Domain tables are added
  through migrations in later milestones.
- API and worker run as separate Compose services. In-memory caches are
  process-local and are not shared between them; persisted snapshots or Redis
  coordination will be introduced with the ingestion milestone.
- The current snapshot loop is disabled in the Compose API container and runs
  in the worker container to avoid issuing duplicate upstream requests. Until
  snapshots are persisted, the API process cannot consume that worker cache;
  this is explicitly resolved in the ingestion milestone.

## F1: Public demo data provider

- The public Render web service and worker use `MARKET_PROVIDER=csv`. The default
  backend setting is also `csv`, so an omitted environment variable cannot
  trigger upstream requests unexpectedly.
- CSV is synthetic demo data. Responses must retain the `csv-demo` source and
  `synthetic-demo` data mode; it is not a fallback for a failed real provider.
- `vnstock==5.2.1` is optional and installed via
  `backend/requirements-vnstock.txt` for local development only. The base and
  container requirements do not install it.
- Local package metadata confirms vnstock 5.2.1 is installed in the existing
  developer virtual environment. A read-only call to `Reference().equity.list_by_exchange()`
  returned an `EntitlementError` for the Guest tier. No API key or eligible
  account was provided, so symbol coverage, quote/history shape and upstream
  quota could not be verified in this environment.
- The current vnstock license says upstream data rights are not granted by the
  software license and must be checked with the data source; it also requires
  a separate written agreement for products whose primary value is third-party
  data access. Therefore the public demo must remain synthetic until access,
  storage and public-display rights are confirmed. See the [current license](https://vnstocks.com/policies/license).
- DNSE and SSI remain candidates for a later credentialed spike. No production
  provider is selected based solely on docs or SDK availability.

## F2: Provider identity, source isolation, and price ingestion

- Each provider declares a stable `source_id`, `data_mode`, and stock-price
  multiplier. CSV emits VND values unchanged; vnstock's VCI equity values use
  the explicit multiplier inherited from the existing ingestion behavior.
  Index points are never multiplied. The vnstock multiplier remains unverified
  against a live entitled response and must be checked before enabling it.
- `price_bars` and `index_bars` are keyed by symbol/date/source. Queries use the
  configured source so old rows from another provider remain stored but are not
  mixed into the active response. Downgrade refuses to collapse overlapping
  bars from different providers.
- Price ingestion records a `provider_job_runs` row and distinguishes success,
  partial/empty, and failure. `GET /api/v1/market/data-status` exposes the
  active source, latest bar dates, last run summary, and stale/no-data state.
- The source contract standardizes timestamps to the Vietnam trading date,
  skips invalid/non-positive closes, deduplicates duplicate dates and keeps
  missing volume as `null` rather than inventing zero.

## F3: Versioned API and frontend mapping

- `/api/v1/stocks`, stock detail/history/indicators, `/api/v1/search`,
  `/api/v1/news`, and `/api/v1/market/data-status` use camelCase API fields.
  The frontend API client is the single mapping point to its existing
  snake_case view models.
- Market responses expose `source`, `dataMode`, and `asOf` where applicable;
  per-bar responses carry their own provenance. Missing bars and fundamentals
  remain `null`, rather than being represented as zero.
- Stock listing supports server-side query, exchange, sector, sort, limit and
  offset. Search folds Vietnamese accents in both ticker/company data and the
  query, including `đ`/`Đ` to `d`.
- News listing supports query, category, heuristic sentiment and symbol filters
  with pagination. Its `sentimentMethod` is `keyword-baseline`, since the
  classifier is a keyword heuristic rather than an AI model.
- Migration `0007_normalized_search` persists normalized search text and
  backfills existing symbols and news articles. Apply migrations before using
  the new search filters against an existing database.

## F4: News source, normalization, and permissions

- The feed defaults now point to VnExpress Kinh doanh and VnEconomy Chứng khoán.
  Both publishers list these channels on their [VnExpress RSS page](https://vnexpress.net/rss)
  and [VnEconomy RSS page](https://vneconomy.vn/rss.html). Those pages state that
  feeds are free for individuals and non-profit organizations, ask users to
  provide source information, and reserve the right to stop RSS redistribution.
- The owner confirmed permission to store and display the approved feeds.
  `NEWS_FEED_ENABLED=true` is configured for the Render web and worker services
  and in `.env.example`; `Settings` keeps a fail-closed default of `false` for
  deployments that omit the variable. News cards retain publisher and story URL
  attribution. The owner must review feed terms again before changing project
  distribution or use.
- RSS parsing supports RSS and Atom entries, strips markup, normalizes dates to
  UTC (interpreting naive publisher timestamps as Vietnam time), removes common
  tracking parameters, sorts stories newest-first, and deduplicates by canonical
  URL or accent-folded headline plus publication day. News-to-symbol matching
  folds Vietnamese accents; sentiment remains explicitly `keyword-baseline`.
- HNX publishes an official RSS catalog and issuer-disclosure pages, but the
  feed endpoints and reuse terms were not verified in this pass. HOSE issuer
  disclosures were not integrated because no documented stable feed/API was
  confirmed. Add official disclosures after their interface and use rights are
  verified.

## F5: Daily-close event study

- `daily-close-v1` defines T as the first stock close strictly after the
  article's Vietnam-local publication time. A publication before 15:00 may use
  that session's close; one at/after 15:00 uses the next available stock bar.
  T+1 is the next stock bar and T+5 is the fifth subsequent stock bar, so
  weekends and market holidays follow the stored trading calendar.
- Stock returns require `adjusted_close`; feeds without an adjusted series are
  `insufficient_data`. CSV synthetic bars are also always `insufficient_data`
  for event-study output. The migration adds nullable `price_bars.adjusted_close`
  and `news_event_studies` stores per-article/per-symbol dates, closes, returns,
  benchmark values, source, data mode, status and method version.
- VN-Index is the benchmark. Abnormal return is the adjusted stock close-to-close
  return minus the VN-Index return over the exact same dates, in percentage
  points. Missing exact benchmark bars yield `pending` while the benchmark is
  behind, otherwise `insufficient_data`.
- T+1/T+5 windows with another linked article for the same symbol are marked
  `overlapping_event`; their numeric returns are withheld. Results describe
  observed price movement and do not claim causality or recommendations.
- The worker recomputes event rows after news ingestion and end-of-day price
  ingestion. The news API returns per-symbol T+1/T+5 windows for article cards
  and stock-chart pins. No grouped “similar news” aggregate is exposed yet.

## FE-43a: đơn vị cổ tức
- `fundamentals.dividend_yield` là `Numeric(9,4)`, API trả nguyên giá trị; hiện chưa có seed hay provider nào ghi cột này. Quy ước chốt: lưu dạng phân số (0,028 = 2,8%), giao diện nhân 100 khi hiển thị. Provider ghi cột này sau này phải theo quy ước đó.

## BE: Vnstock Community cho bản chạy cục bộ (07/11/2026)
- Chủ dự án chọn Vnstock Community thay DNSE cho giai đoạn thử nghiệm cá nhân/đồ án. Luồng DNSE trong `docs/BACKEND_PLAN.md` tạm dừng; không coi key Community là quyền công bố dữ liệu của VCI/KBS.
- Adapter hiện dùng VCI cho giá cổ phiếu và Vnstock mặc định cho chỉ số. Theo tài liệu Vnstock, VCI OHLCV là giá đã điều chỉnh theo sự kiện quyền, đơn vị nghìn đồng; lưu `close` và `adjusted_close` bằng đồng. Vì nguồn không trả riêng giá đóng cửa chưa điều chỉnh qua OHLCV này, biểu đồ lịch sử hiển thị chuỗi đã điều chỉnh.
- Chỉ ingest 15 mã được cấu hình, ba chỉ số, và giới hạn nhịp gọi. Bản public/Render vẫn dùng `csv-demo`; trước khi hiển thị giá thật công khai cần xác nhận quyền lưu và hiển thị từ chủ nguồn dữ liệu.
- Kiểm tra trực tiếp với Vnstock 5.2.1 chưa có key trả `EntitlementError` cho `reference.market.symbols_by_exchange`; cần khóa Community miễn phí để hoàn tất kiểm tra end-to-end.
- T+1/T+5 chỉ hiện số khi `status=measured`, `dataMode=market-provider` và có `methodVersion`; còn lại hiện "Dữ liệu minh hoạ" (hàm `reactionLabel` trong `lib/reactions.ts`).
