# FinSight — Hồ sơ bàn giao và đánh giá dự án

**Ngày chốt hiện trạng:** 07/11/2026  
**Mục đích:** để một agent khác hiểu sản phẩm, kiến trúc, phần đã làm, trạng thái chạy, giới hạn dữ liệu và các quyết định còn mở mà không cần lần lượt đọc toàn bộ repo. Tài liệu này mô tả code hiện tại; nếu thấy khác với code thì lấy code và kết quả chạy mới nhất làm chuẩn.

## 1. Tóm tắt cho người tiếp nhận

FinSight là ứng dụng web phân tích và theo dõi thị trường chứng khoán Việt Nam. Đây đã là một ứng dụng fullstack gồm frontend, backend API, PostgreSQL, Redis, worker nền, RSS news, chỉ báo kỹ thuật và phép đo phản ứng giá quanh tin.

Stack local đã được khởi chạy và kiểm tra:

- Frontend: http://localhost:3000
- FastAPI docs: http://localhost:8000/docs
- Readiness: http://localhost:8000/ready
- Docker services: frontend, backend, worker, PostgreSQL và Redis đang chạy.
- Database đang ở migration 0008_news_event_studies (head).
- Bộ test backend hiện có: 38 passed; Ruff và kiểm tra TypeScript frontend qua.
- Ba trang /market, /news, /stock/HPG không tràn ngang ở viewport 390px và 1200px. Trình duyệt điều khiển trong phiên chỉ cho viewport desktop thực tế 1200px, dù đã yêu cầu 1440px.

**Điểm cần hiểu đúng:** app hiện dùng được end-to-end cho demo, nhưng giá trong môi trường Docker hiện tại là CSV tổng hợp, không phải giá thị trường. Tin RSS là nguồn ngoài; điều đó không biến giá cổ phiếu thành dữ liệu thật. Chưa có adapter DNSE hoặc SSI. Adapter vnstock có trong source nhưng package vnstock không nằm trong image Docker mặc định.

**Không thể chuyển sang provider thật chỉ bằng cách đổi một biến môi trường.** Factory hiện chỉ nhận csv và vnstock. Để dùng DNSE/SSI cần đăng ký và xác nhận điều khoản, xây adapter, kiểm thử chuẩn hoá dữ liệu, đồng bộ lịch sử và ảnh chụp giá, sau đó mới đổi provider.

## 2. FinSight giải quyết việc gì

FinSight gom thông tin thị trường, mã cổ phiếu, giá lịch sử và tin liên quan để người dùng xem trong một giao diện. Sản phẩm có phần giải thích dữ liệu, chỉ báo kỹ thuật và phản ứng giá sau tin; không đặt lệnh và không đưa khuyến nghị mua/bán.

Các luồng giao diện chính:

| Trang | Vai trò hiện tại |
|---|---|
| / | Trang vào ứng dụng/landing. |
| /dashboard | Tổng quan chỉ số, độ rộng, ngành, biến động, tin; có widget giải thích và chat. |
| /market | Screener mã, tìm kiếm không phân biệt dấu, lọc/sắp xếp và link mã. |
| /news | Tin theo hàng, lọc/tìm kiếm, nguồn tin, sentiment heuristic, mã liên quan và trạng thái phản ứng giá. |
| /stock/[symbol] | Quote từ dữ liệu đang chọn, biểu đồ OHLCV, chỉ báo tính từ chuỗi giá, tin liên quan và T+1/T+5. |
| /account | Đăng nhập/đăng ký, watchlist và portfolio cá nhân qua API. |
| /backtest | Chạy/xem backtest qua API. |

Các trang có nội dung dữ liệu minh hoạ phải cho biết khi nguồn là synthetic. Màu xanh/đỏ là màu biến động giá, không mang hàm ý khuyến nghị đầu tư.

## 3. Công nghệ và sơ đồ tổng thể

### Frontend

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- lightweight-charts cho biểu đồ nến; Recharts cho một số biểu đồ khác.
- API client tập trung ở frontend/lib/api.ts.
- Route handler Next.js làm proxy giữa trình duyệt và FastAPI. Frontend không nên gọi nhà cung cấp dữ liệu trực tiếp, để không lộ khoá nhà cung cấp.
- npm run lint hiện chạy tsc --noEmit (kiểm tra TypeScript; không phải ESLint).
- CSS có hỗ trợ prefers-reduced-motion.

### Backend và hạ tầng

- Python 3.12 trong Docker; FastAPI; SQLAlchemy async; Alembic.
- PostgreSQL 16 lưu mã, giá, tin, nghiên cứu sự kiện, tài khoản, watchlist, portfolio và kết quả backtest.
- Redis 7 dùng cho cache/rate limit khi được cấu hình.
- Worker dùng APScheduler để ingest giá/tin và tính event study.
- Docker Compose chạy frontend, backend, worker, Postgres và Redis.
- Render Blueprint có cấu hình deploy; cấu hình mặc định của Render cũng dùng MARKET_PROVIDER=csv.

### Luồng dữ liệu khái quát

~~~text
Nguồn giá → provider adapter → jobs ingest → PostgreSQL
                                            ↓
Trình duyệt → Next API client → Next proxy → FastAPI /api/v1 → PostgreSQL

RSS → fetch/chuẩn hoá/deduplicate → PostgreSQL → liên kết mã → event study → /api/v1/news
~~~

Một số endpoint tương thích cũ vẫn tồn tại trong backend/main.py và các route handler riêng dưới frontend/app/api/. Những route này nên được giữ cho tới khi agent kiểm tra được caller và parity với API v1.

## 4. Backend, provider và ingest giá

### Provider hiện có

Hợp đồng chuẩn của provider nằm ở backend/providers/base.py. Các thao tác hợp đồng gồm danh sách mã, quote snapshot, OHLCV cổ phiếu, snapshot chỉ số, lịch sử chỉ số và profile doanh nghiệp.

| Provider | Có trong code | Cài mặc định trong Docker | Tình trạng |
|---|---:|---:|---|
| CSV demo | Có | Có | Provider mặc định, dữ liệu synthetic gắn source=csv-demo, dataMode=synthetic-demo. |
| vnstock | Có adapter v5 | Không | Adapter gọi Market/Reference, lấy history từ VCI và có giả định giá cổ phiếu cần nhân 1.000. Cần cài package riêng, key/entitlement có thể cần, kiểm chứng schema/đơn vị/điều khoản trước khi dùng. |
| DNSE | Chưa có | Không | Chưa thể đặt MARKET_PROVIDER=dnse; factory sẽ từ chối. |
| SSI FastConnect Data | Chưa có | Không | Chưa thể đặt MARKET_PROVIDER=ssi; factory sẽ từ chối. |

Factory hiện tại ở backend/providers/factory.py chỉ ánh xạ csv → csv-demo và vnstock → vnstock. Không có fallback âm thầm sang CSV khi provider thật lỗi.

### Cách giá đi vào database

- backend/jobs/ingest_symbols.py đồng bộ danh sách mã của provider vào symbols.
- backend/jobs/ingest_prices.py gọi symbol list, tải OHLCV cho từng mã và lịch sử các chỉ số, chuẩn hoá thành các bar rồi upsert vào price_bars/index_bars.
- Bar có source trong khoá dữ liệu: cùng symbol/ngày có thể giữ dữ liệu của nhiều provider mà không ghi đè chéo.
- Normalizer chấp nhận một số tên cột khác nhau, bỏ bar thiếu ngày/close hoặc giá không hợp lệ, đổi đơn vị theo stock_price_multiplier, và lưu adjusted_close khi provider trả trường này.
- Mỗi lần ingest ghi trạng thái vào provider_job_runs; API data status dựa trên dữ liệu và lần chạy gần nhất.
- CSV demo có 15 mã, dữ liệu lịch sử synthetic. Trong lần kiểm tra API gần nhất, HPG có asOf=2026-10-30.

Worker Compose hiện:

- Đồng bộ symbol lúc khởi động.
- Nếu provider chưa có bar nào, ingest lịch sử ban đầu khoảng 730 ngày.
- Tính lại news event study sau ingest tin và sau ingest EOD.
- Chạy RSS mỗi 15 phút khi NEWS_FEED_ENABLED=true.
- Chạy ingest giá lịch sử EOD lúc 15:40 giờ Việt Nam các ngày thứ Hai–thứ Sáu.

Phần trên hiện chưa phải luồng lưu quote từng phút vào bảng thời gian thực. API v1 stocks/market đọc bar đã lưu trong database. Dashboard cũng polling trình duyệt theo phiên mở cửa, nhưng polling UI tự nó không làm provider trả dữ liệu realtime và không thay thế job lưu quote.

## 5. API hiện có

FastAPI v1 dùng prefix /api/v1. Response thị trường/tin mang metadata nguồn phù hợp như source, asOf, dataMode; thiếu dữ liệu được biểu diễn bằng null/trạng thái, không nên đổi thành 0 giả.

| Nhóm | Endpoint chính |
|---|---|
| Readiness/health | GET /ready, GET /health |
| Market | GET /api/v1/market/overview, /commentary, /indices, /data-status, /breadth, /sectors, /movers, /active |
| Stocks | GET /api/v1/search, /stocks, /stocks/{symbol}, /stocks/{symbol}/history, /stocks/{symbol}/indicators, /stocks/{symbol}/signals |
| News | GET /api/v1/news — hỗ trợ lọc theo từ khoá, category, sentiment, mã, limit/offset; phản ứng giá đi cùng từng tin/mã khi có record event study |
| Auth | /api/v1/auth/register, /login, /refresh, /logout, /me |
| Watchlist/portfolio | /api/v1/watchlist, /api/v1/watchlist/{symbol}, /api/v1/portfolio/positions, /transactions, /trades |
| Backtest | POST/GET /api/v1/backtests, GET /api/v1/backtests/{run_id} |

Frontend map một phần trường camelCase v1 sang kiểu snake_case cũ bên trong frontend/lib/api.ts; đây là lớp mapping tập trung. Route proxy tổng quát nằm ở frontend/app/api/v1/[...path]/route.ts. BACKEND_API_URL là URL upstream server-side của Next.js, không phải URL của nhà cung cấp giá.

API smoke test đã kiểm tra:

- /ready trả 200 và báo database/Redis OK.
- Stocks, HPG detail/history/indicators, news theo HPG trả 200.
- Mã lạ trả 404 SYMBOL_NOT_FOUND.
- Nguồn giá hiển thị csv-demo, synthetic-demo.

## 6. Tin tức và cách đo phản ứng giá

### Pipeline tin

- RSS mặc định: VnExpress Kinh doanh và VnEconomy chứng khoán.
- NEWS_FEED_ENABLED bật/tắt ingest cho backend/worker.
- Tin được chuẩn hoá URL canonical, thời gian, title/summary; lưu publisher, URL, published time và hash.
- Ingest lặp dùng URL/hash để không chèn lại bài trùng.
- Mã liên quan được gắn bằng matching tên/mã; sentiment là keyword-baseline, không phải mô hình AI.
- Mỗi bài giữ tên nguồn và link gốc.
- Ingest RSS chạy lặp hai lần trong kiểm tra; lần sau không tăng số dòng database.

### T+1/T+5

- Logic ở backend/domain/event_study.py; persistence/job ở backend/jobs/compute_event_studies.py.
- Benchmark là VN-Index.
- Bar sự kiện là phiên đóng cửa đầu tiên sau thời gian xuất bản; bài sau giờ đóng cửa đợi phiên kế tiếp.
- T+1/T+5 là phiên thứ nhất/thứ năm sau bar sự kiện.
- Cổ phiếu dùng adjusted close; benchmark dùng close VN-Index.
- Abnormal return = return cổ phiếu trừ return benchmark trên cùng cửa sổ.
- Tin khác cùng mã trong cửa sổ làm kết quả bị đánh dấu chồng lấn.
- Giá synthetic, thiếu adjusted close, benchmark hoặc bar tương lai không sinh phần trăm đo được; API trả pending, insufficient_data hoặc overlapping_event cùng lý do.
- Đây là biến động quan sát được, không chứng minh tin là nguyên nhân.

Vì giá hiện là synthetic, các T+1/T+5 của tin hiện không phải kết quả đo thị trường và được đánh dấu không đủ điều kiện đo.

## 7. Database và migrations

Các bảng chính:

- Danh mục: symbols.
- Giá cổ phiếu: price_bars với khoá gồm symbol, trade date, source; có trường adjusted_close.
- Chỉ số: index_bars.
- Fundamentals: fundamentals (schema đã có; chưa có pipeline ingest fundamentals riêng trong provider contract hiện tại).
- Snapshot và lịch sử job: market_snapshots, provider_job_runs.
- Tin: news_articles, quan hệ mã news_symbols, event study news_event_studies.
- Tài khoản: users, refresh_tokens, watchlist_items, portfolio_positions, portfolio_transactions.
- Backtest: backtest_runs.

Alembic revisions từ 0001_initial_schema tới 0008_news_event_studies. Compose chạy alembic upgrade head trước khi bật backend. Kiểm tra head bằng docker compose exec backend alembic current.

## 8. Tài khoản, portfolio, backtest và AI

- Auth dùng email/password, access JWT và refresh cookie HTTP-only. Register/login có rate limit; Redis dùng nếu cấu hình được, nếu không có in-memory fallback.
- Watchlist và portfolio được phân tách theo user.
- API portfolio ghi giao dịch người dùng và tính position; không gửi lệnh tới công ty chứng khoán.
- Backtest hỗ trợ buy-and-hold, DCA, SMA crossover và RSI mean reversion; kết quả lưu riêng cho user. Đây là thử nghiệm giả lập, không phải performance tương lai.
- Explain/chat gọi OpenRouter khi có OPENROUTER_API_KEY; nếu không thì service có deterministic fallback. Trong phiên kiểm tra gần đây biến này chưa được đặt, do đó chưa xác nhận được phản hồi từ model bên ngoài.

## 9. Cấu hình hiện tại và cách chạy

### Docker local

1. Tạo file local từ mẫu:

~~~powershell
Copy-Item .env.example .env
~~~

2. Khởi động:

~~~powershell
docker compose up --build -d
docker compose ps
~~~

3. Kiểm tra backend và migration:

~~~powershell
Invoke-RestMethod http://localhost:8000/ready
docker compose exec backend alembic current
~~~

4. Mở frontend tại http://localhost:3000.

Compose giữ database trong volume postgres_data. docker compose down dừng stack và giữ dữ liệu volume. Không dùng docker compose down -v nếu chưa chủ ý xoá database.

### Biến môi trường quan trọng

| Tên | Ý nghĩa/giá trị hiện tại |
|---|---|
| MARKET_PROVIDER | csv mặc định; hiện chỉ csv và vnstock được factory chấp nhận. |
| VNSTOCK_API_KEY | Key đăng nhập vnstock nếu entitlement và adapter cần. Chỉ giữ ở môi trường backend/worker. |
| NEWS_FEED_ENABLED | true bật RSS đã được chủ dự án cho phép; false trả trạng thái disabled/rỗng. |
| DATABASE_URL | PostgreSQL async URL. Compose nối tới service db. |
| REDIS_URL | Redis URL. Compose nối tới service redis. |
| BACKEND_API_URL | URL backend nhìn thấy từ tiến trình Next.js; Compose dùng http://backend:8000. |
| OPENROUTER_API_KEY / OPENROUTER_MODEL | AI upstream và model. |
| JWT_SECRET | Secret production bắt buộc phải được tạo riêng, không để giá trị dev. |
| CORS_ORIGINS | Các origin được phép khi frontend/backend khác origin. |

Không đặt API key tài chính thành biến NEXT_PUBLIC_*, không commit .env, và không gửi secret trong prompt/log. Khi thêm provider phải khai báo biến server-side mới trong Settings, Compose/Render và .env.example.

## 10. Dữ liệu thị trường thật: lựa chọn và điều kiện

“Dữ liệu thật” và “realtime” là hai yêu cầu khác nhau:

1. **Nguồn thật, EOD hoặc delayed:** giá đến từ provider thật, nhưng cập nhật theo cuối ngày hoặc độ trễ/chu kỳ mà hợp đồng cho phép.
2. **Realtime/intraday:** cần sản phẩm dữ liệu tương ứng, quyền sử dụng, endpoint/stream, worker hoặc consumer stream, quy tắc quota và UI hiển thị thời điểm dữ liệu.

FinSight hiện hỗ trợ daily bars về mặt database. Muốn dashboard có quote intraday nhất quán giữa dashboard, screener và trang mã thì còn phải lưu/đọc quote snapshot hoặc thiết kế API snapshot chung; không chỉ cập nhật một endpoint cũ.

### Các đường khả thi

| Nguồn | Khi phù hợp | Điều đã biết và việc phải xác minh |
|---|---|---|
| DNSE OpenAPI | Muốn thử một API thị trường chính thức, có REST cho OHLC lịch sử và nhiều loại dữ liệu thị trường | Tài liệu có endpoint OHLC cổ phiếu/chỉ số, quote/khớp lệnh và ngày làm việc. REST yêu cầu API key và chữ ký HMAC; phải đăng ký dịch vụ. Hỏi DNSE bằng văn bản về entitlement dữ liệu, EOD/realtime/delay, quyền lưu/hiển thị cho người dùng, quota, phí, coverage/lịch sử và adjusted prices. |
| SSI FastConnect Data | Muốn EOD/realtime và có thể cần streaming | Tài liệu mô tả EOD/realtime, API daily/intraday và streaming. Đăng ký dịch vụ hiện cần tài khoản SSI và làm thủ tục qua quầy/nhân viên; credentials gồm ConsumerID, ConsumerSecret, PrivateKey, và cần đăng ký IP cố định. Hỏi về phí, quota, quyền public display, lịch sử và adjusted data. |
| vnstock 5 | Thử nghiệm cá nhân/đồ án trong phạm vi license | Là toolkit nối tới nguồn bên thứ ba, không phải chủ sở hữu dữ liệu. Cài từ package index chính thức, kiểm tra tier/key, nguồn thực tế, quota và license dữ liệu. License hiện hành nêu Community cho cá nhân/học tập/nghiên cứu và yêu cầu thỏa thuận riêng bằng văn bản nếu sản phẩm chính cung cấp cho bên thứ ba khả năng truy xuất dữ liệu. Adapter repo chưa nằm trong Docker mặc định. |
| CSV demo | UI, CI, offline và review | Luôn chạy được; không được gọi là dữ liệu thị trường thật. |

Tham khảo chính thức đã kiểm tra ngày 07/11/2026:

- [DNSE — danh mục API dữ liệu thị trường](https://developers.dnse.com.vn/docs/dnse/market-data/)
- [DNSE — xác thực API key/chữ ký](https://developers.dnse.com.vn/docs/guide/intro/authentication/)
- [SSI — FastConnect Data](https://guide.ssi.com.vn/ssi-products/fastconnect-data)
- [SSI — thủ tục đăng ký dịch vụ](https://guide.ssi.com.vn/ssi-products/service-registration)
- [SSI — API specs](https://guide.ssi.com.vn/ssi-products/fastconnect-data/api-specs)
- [vnstock — hướng dẫn/license và giới hạn phân phối](https://github.com/thinh-vu/vnstock/blob/main/README.md)

Không có thông tin đủ để khẳng định API nào miễn phí, quyền public display nào đã được cấp, hoặc nguồn nào bao phủ lịch sử điều chỉnh phù hợp. Phải hỏi nhà cung cấp trước khi phát hành dữ liệu cho người dùng ngoài nhóm phát triển.

## 11. Kế hoạch thực tế để chuyển sang dữ liệu thật

### Bước A — Chốt yêu cầu và quyền dữ liệu

Trả lời trước khi tích hợp:

1. Chỉ chạy cá nhân/local, demo kín, hay website công khai?
2. Cần giá EOD, giá có độ trễ, intraday hay streaming realtime?
3. Cần HOSE thôi hay HOSE + HNX + UPCOM; bao nhiêu mã?
4. Cần lịch sử bao nhiêu năm và có cần adjusted price/fundamentals không?
5. Ngân sách, phí API, phí license, và số request/phút được phép?

Yêu cầu provider xác nhận bằng văn bản quyền gọi, lưu database, cache, hiển thị/public display, attribution, retention, quota, phí, lịch sử và độ trễ. Mở API key không tự động đồng nghĩa được quyền phân phối lại dữ liệu.

### Bước B — Chọn một nguồn thật chính

Đề xuất khởi đầu với **một** nguồn chính, không đồng bộ nhiều nguồn trước khi schema/rights rõ ràng. DNSE phù hợp để thử REST thị trường nếu DNSE cấp entitlement và chấp thuận mục đích sử dụng. SSI phù hợp nếu đã có tài khoản/dịch vụ và chấp nhận thủ tục đăng ký + fixed IP. vnstock chỉ là lối thử nghiệm riêng tư sau khi kiểm tra license, không phải lời giải mặc định cho public app.

### Bước C — Viết adapter trong backend

Với DNSE/SSI, implementation cần tối thiểu:

1. Tạo adapter mới cạnh csv_seed_provider.py và vnstock_provider.py.
2. Cài provider/SDK hoặc HTTP client trong backend; implement auth ở server-side.
3. Bổ sung Settings và secret env vars; không đưa key vào frontend.
4. Thêm tên provider và source ID vào backend/providers/factory.py.
5. Implement đầy đủ MarketDataProvider: symbol directory, quote snapshot, OHLCV, chỉ số/history, profile.
6. Chuẩn hoá symbol/exchange, timezone Asia/Ho_Chi_Minh, đơn vị tiền, volume, chỉ số, bar trùng, null và lỗi. Có kiểm tra OHLC hợp lệ.
7. Xác minh bằng payload thật: các nguồn Việt Nam có thể trả giá theo nghìn đồng; không nhân 1.000 hoặc bỏ adjusted price nếu chưa dựa trên tài liệu endpoint đã chọn.
8. Thêm test fixture cho payload provider, signature/auth (nếu có), pagination, quota, retry/backoff, timeout và data normalization. Test CI phải không cần secret/network.
9. Ghi source, dataMode, asOf, thời điểm ingest và trạng thái provider nhất quán.
10. Provider thật lỗi/stale thì trả lỗi/trạng thái stale; không đổi sang CSV.

DNSE cần secrets tương ứng API key/API secret và chữ ký mới theo request nếu dùng REST signature. SSI cần ConsumerID/ConsumerSecret/PrivateKey; hạn chế quyền file/private key và cố định IP theo yêu cầu nhà cung cấp. Tên biến chính xác phải khớp với implementation adapter; repo hiện chưa có các biến DNSE/SSI.

### Bước D — Đồng bộ dữ liệu và giữ dữ liệu cũ an toàn

1. Đặt provider cùng một giá trị cho backend và worker.
2. Migrate nếu adapter cần bảng/column mới; giữ source trong khoá bar.
3. Backfill lịch sử riêng dưới source ID của provider mới. Worker hiện tự backfill khoảng 730 ngày khi source mới chưa có bar; nếu cần 5 năm phải bổ sung/chạy backfill với khoảng ngày đó và xác nhận quota.
4. Không xoá csv-demo khi chuyển source; API chọn dữ liệu theo source đang cấu hình. Có thể rollback về CSV khi cần demo.
5. Kiểm tra gap ngày, lịch giao dịch, symbol coverage và số bar trước khi bật provider.
6. Nếu cần T+1/T+5, phải có adjusted close thật và VNINDEX cùng provider/cùng ngày. Tài liệu OHLCV cơ bản không tự đảm bảo adjusted close; xác nhận corporate actions với nguồn hoặc xây dữ liệu adjustment đã được cấp quyền.

### Bước E — Thêm quote snapshot nếu yêu cầu intraday

Daily close không phải realtime. Để quote trên dashboard, market và stock khớp nhau:

1. Chốt nguồn snapshot (REST polling hay WebSocket), độ trễ mong muốn và giới hạn request.
2. Thêm job/consumer theo chu kỳ được provider cho phép; batch symbols nếu API hỗ trợ.
3. Lưu snapshot hoặc thêm model phù hợp để có source, timestamp nguồn, timestamp ingest và trạng thái.
4. Định nghĩa API duy nhất cho latest quote; cho cả dashboard, screener và trang mã đọc cùng snapshot.
5. Dừng polling ngoài phiên/ở tab ẩn hoặc khi stale; không coi 10 giây poll của browser là cam kết realtime.
6. Hiển thị “realtime”, “delayed”, “EOD” dựa trên hợp đồng và timestamp thật; không suy ra từ provider name.

### Bước F — Cấu hình chạy

Khi adapter đã được implement/test:

1. Lưu secrets trong .env local (file này không commit) hoặc secret store của Render.
2. Cấu hình MARKET_PROVIDER giống nhau cho backend và worker.
3. Nếu thay Docker dependencies, rebuild backend image; restart backend và worker.
4. Chạy migrations, seed/backfill, xem worker logs và /api/v1/market/data-status.
5. Gọi stock, history, indicators, indices và market overview; xác nhận source mới, dataMode=market-provider, asOf phù hợp và không còn csv-demo.
6. So sánh ít nhất vài mã/chỉ số với app/website chính thức cùng timestamp; kiểm tra đơn vị giá, điều chỉnh, ngày nghỉ và volume.
7. Chỉ sau các bước này mới deploy public; kiểm tra key không xuất hiện trong browser bundle, logs hoặc git.

## 12. Chuyển provider và API hiện tại: điều không nên làm

- Không chỉ đổi MARKET_PROVIDER=dnse hoặc ssi: các tên này hiện chưa hợp lệ trong factory.
- Không bật MARKET_PROVIDER=vnstock trong Docker hiện tại mà chưa cài package; image không cài requirements-vnstock.txt.
- Không mặc định vnstock license cho phần mềm cũng cấp quyền nguồn dữ liệu hoặc public redistribution.
- Không kết luận dữ liệu là live dựa trên việc UI tự refresh mỗi 10 giây.
- Không dùng close thường thay adjusted close cho event study nếu chưa xử lý chia tách/cổ tức.
- Không chuyển API key từ backend sang biến NEXT_PUBLIC_*.
- Không chạy backfill toàn bộ mã cho tới khi biết quota/giới hạn và được phép.

## 13. Stage plan và tiến độ

Kế hoạch tổng ở IMPLEMENTATION_PLAN.md. Tóm tắt hiện trạng:

| Stage | Mục tiêu | Hiện trạng |
|---|---|---|
| F0 | Audit hiện trạng, endpoint và mock | Hoàn thành và được ghi trong plan/audit. |
| F1 | Đánh giá nguồn dữ liệu | CSV vẫn là provider demo; vnstock tùy chọn; DNSE/SSI chưa tích hợp hoặc được cấp key/quyền. Không tuyên bố có nguồn production. |
| F2 | Provider adapter và ingest an toàn | Hợp đồng, CSV/vnstock adapter, chuẩn hoá/upsert/provider job status có. |
| F3 | API v1 | Các route market, stocks, news, account và backtests có. |
| F4 | RSS news | RSS, dedupe, attribution, heuristic sentiment, bật/tắt và empty state có. |
| F5 | T+1/T+5 | Event study versioned có; synthetic/thiếu adjusted data không cho số đo. |
| F6 | Nối UI | Market/news/stock dùng API client v1, có loading/empty/error và metadata nguồn; một số API legacy vẫn còn. |
| F7 | Tích hợp, QA và tài liệu | Compose, migration, endpoint smoke test, backend test/lint, frontend TypeScript/build và responsive đã kiểm tra trong local. |

## 14. Đánh giá độc lập đề nghị cho agent tiếp theo

Yêu cầu agent review-only (chưa sửa code) và trả báo cáo theo mức P0/P1/P2:

1. Có chỗ nào vẫn render giá mock/legacy hoặc trộn nguồn giữa dashboard, /market, /stock không?
2. Hợp đồng /api/v1 và mapping trong frontend/lib/api.ts có khớp field/status/units không?
3. Provider VNStock v5 có cài và hoạt động được trong đúng môi trường deploy không; license có phù hợp với cách app được dùng không?
4. Với DNSE và SSI, nguồn nào đáp ứng tốt nhất về quyền lưu/public display, coverage, adjusted history, quota, latency, phí và độ dễ triển khai?
5. Ingest có thể gọi quá quota khi mở rộng 15 mã thành toàn thị trường không? Nên batch/backfill/poll thế nào?
6. T+1/T+5 có đúng phiên, timezone, adjusted close, VNINDEX, ngày nghỉ, overlap và benchmark không?
7. Có lỗ hổng secrets, auth, CORS, rate limit, SQL ownership, log hoặc cấu hình Render/Docker nào cần chặn trước public deploy không?
8. Mọi trang có dữ liệu đều hiển thị đúng nguồn, thời điểm, delayed/EOD/live và nhãn synthetic không?
9. Migrations có an toàn với volume đã có dữ liệu và rollback được không?
10. Ưu tiên các việc cần làm trước khi gọi đây là dữ liệu thật/realtime; trích file và dòng cụ thể.

Agent chỉ nên đề xuất một lộ trình provider chính cùng tiêu chí nghiệm thu; không coi việc gọi được endpoint là đủ để kết luận quyền public display đã được cấp.

## 15. Nguồn thông tin trong repo

- README.md: chạy app, stack và biến môi trường cơ bản.
- IMPLEMENTATION_PLAN.md: phạm vi fullstack và các stage.
- docs/fullstack-audit.md: audit nền.
- docs/decisions.md: các quyết định về nguồn và điều khoản.
- backend/VNSTOCK_SETUP.md: cài adapter vnstock tùy chọn và giới hạn hiện tại.
- backend/providers/: provider contract/factory/adapters.
- backend/jobs/: price/news ingest và event-study job.
- backend/api/v1/: API hiện hành.
- backend/domain/: indicator, sentiment, portfolio, backtest và event-study logic.
- backend/alembic/versions/: lịch sử migration.
- frontend/lib/api.ts: client và mapping response.
- frontend/app/api/: proxy Next.js tới backend.
- frontend/app/: route pages.

