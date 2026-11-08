# FinSight – Kế hoạch Backend giai đoạn 4 (giao cho Codex)

> **Cập nhật 08/11/2026:** Chủ dự án chọn Vnstock Community cho chạy thử cục bộ và yêu cầu toàn bộ mã đang giao dịch (HOSE, HNX, UPCOM). Luồng 1 DNSE ở dưới tạm dừng; các task BE-10–BE-17 chỉ còn là phương án nếu sau này chọn DNSE và được cấp quyền dữ liệu. Xem `backend/VNSTOCK_SETUP.md` và quyết định mới ở `docs/decisions.md`. Luồng 0 vẫn áp dụng. Bảng hiện trạng mục 2 là mốc trước các thay đổi BE-00/BE-01/BE-VN ghi trong `docs/backend-log.md`.

*Tài liệu bàn giao cho agent thực thi. Mỗi phiên làm **một task**, chỉ đọc mục 0–4 và đúng task đó. Mỗi task ghi rõ mức model, file cần đọc, lệnh kiểm tra và tiêu chí xong. Review do người khác làm sau mỗi task, nên commit nhỏ, message rõ.*

Ngày lập: 07/11/2026. Repo: `C:\Users\Huynguyen\Desktop\FinSight`. Kế hoạch giao diện đã xong ở `docs/REDESIGN_PLAN.md` (branch `redesign/phase-3`).

---

## 0. Cách làm việc

1. Tạo branch `backend/phase-4` **từ `redesign/phase-3`** (branch này đã có thay đổi frontend và trường `ai_enabled` ở backend). Không làm trên `main`. Không push nếu chưa được yêu cầu.
2. Mỗi task một commit hoặc một nhóm commit, message dòng đầu `BE-xx: <mô tả ngắn tiếng Việt>`.
3. Cuối mỗi task, thêm một mục vào `docs/backend-log.md` (≤ 10 dòng): việc đã làm, lệch kế hoạch, lệnh kiểm tra đã chạy và kết quả, câu hỏi cho reviewer. Reviewer đọc file này và `git diff` để duyệt.
4. Gặp điểm mơ hồ: chọn cách đơn giản nhất khớp với mục 3, ghi một dòng vào `docs/decisions.md`, rồi làm tiếp. Chỉ dừng lại hỏi khi phải xoá dữ liệu, đổi hợp đồng API hoặc cần secret.
5. Không đọc cả repo. Dùng `rg -n` để ra đúng dòng. File lớn đọc theo đoạn.

## 1. Mục tiêu

Giá thật, có giá điều chỉnh, đủ để T+1/T+5 ra **số đo thật** (`status = measured`, `dataMode = market-provider`). Đây là điều kiện để giao diện hiện số thay cho nhãn "Dữ liệu minh hoạ" (xem `frontend/lib/reactions.ts`).

Có hai luồng:
- **Luồng 0 (làm ngay, không cần nguồn giá thật):** sửa lỗi, tăng độ bền, bổ sung endpoint mà giao diện cần, dọn API cũ, chuẩn bị test.
- **Luồng 1 (chỉ bắt đầu khi có API key DNSE và xác nhận quyền dữ liệu bằng văn bản):** adapter DNSE, backfill, giá điều chỉnh, event study trên dữ liệu thật.

**Ngoài phạm vi:** quote trong phiên và streaming, mở rộng toàn thị trường, đặt lệnh, mô hình NLP cho sentiment, deploy công khai.

## 2. Hiện trạng đã kiểm (07/11/2026)

| Mảng | Hiện trạng | File |
|---|---|---|
| Hợp đồng provider | `MarketDataProvider` có 6 hàm: `list_symbols`, `get_quote_snapshot`, `get_ohlcv`, `get_index_snapshot`, `get_index_history`, `get_company_profile`; trả `pd.DataFrame`; thuộc tính `source_id`, `data_mode`, `stock_price_multiplier` | `backend/providers/base.py:7-36` |
| Factory | Chỉ nhận `csv` → `csv-demo` và `vnstock` → `vnstock`; tên khác báo `ValueError` | `backend/providers/factory.py` |
| vnstock | `stock_price_multiplier = 1000`; không có timeout, retry hay giới hạn tần suất trong provider; gói không có trong `requirements.txt`, nên Docker và CI không import được | `backend/providers/vnstock_provider.py`, `backend/requirements-vnstock.txt` |
| Ingest giá | `ingest_price_history(start, end, symbols=None, request_delay_seconds=0.15)`; upsert `price_bars` theo `(symbol, trade_date, source)`, `index_bars` theo `(index_symbol, trade_date, source)`; ghi `provider_job_runs` | `backend/jobs/ingest_prices.py:79-226` |
| **Lỗi** | `_float(...) * scale` ném `TypeError` khi `_float` trả `None` (giá trị NaN), làm hỏng cả mã | `backend/jobs/ingest_prices.py:65`, `:71` |
| Worker | Backfill 730 ngày khi source chưa có bar; EOD 15:40 thứ Hai–Sáu lấy 3 ngày; thử lại sync ban đầu mỗi giờ | `backend/worker.py:48`, `:68`, `:85` |
| Event study | `METHOD_VERSION = "daily-close-v1"`, benchmark `VNINDEX`; cổ phiếu dùng `adjusted_close`, chỉ số dùng `close`; giá tổng hợp trả `insufficient_data` với lý do `synthetic_price_source` | `backend/domain/event_study.py` |
| Giá điều chỉnh | Chỉ có cột `price_bars.adjusted_close` (nullable). **Không có bảng sự kiện quyền** (cổ tức, chia tách) | `backend/db/models.py:31-43` |
| Fundamentals | Bảng `fundamentals` có `market_cap`, `pe`, `pb`, `eps`, `dividend_yield` (Numeric 9,4); **chưa có job nào ghi**. Giao diện quy ước `dividend_yield` là phân số (0,028 = 2,8%) | `backend/db/models.py:60-72`, `docs/decisions.md` |
| API v1 | `market` (overview, commentary, indices, data-status, breadth, sectors, movers, active), `stocks` (search, list, detail, history, indicators, signals), `news`, `auth`, `account`, `backtests`. **Chưa có endpoint lịch sử chỉ số** | `backend/api/v1/*.py` |
| API cũ | 21 route không có `/api/v1` trong `main.py` (dòng 164–287); giao diện còn gọi `/market/status`, `/market/top-movers`, `/meta/data-sources`, `/ai/explain`, `/ai/chat` qua `frontend/app/api/*` | `backend/main.py`, `frontend/lib/api.ts` |
| Test | 13 file, Postgres thật qua `DATABASE_URL`, **không có `conftest.py`**, không có thư mục fixture cho payload provider | `backend/tests/` |
| Cấu hình | Compose không truyền `JWT_SECRET`, `CORS_ORIGINS`, `VNSTOCK_API_KEY` cho backend và worker; `.env.example` nằm ở gốc repo | `docker-compose.yml`, `render.yaml` |
| CI | `ruff check .`, `mypy domain`, `alembic upgrade head`, `pytest tests -q --cov=domain --cov-fail-under=80` | `.github/workflows/backend-ci.yml` |

## 3. Ràng buộc bắt buộc

1. **Không âm thầm quay về CSV.** Nguồn thật lỗi hoặc dữ liệu cũ thì trả trạng thái lỗi hoặc `stale`, ghi `provider_job_runs`.
2. **Mọi bar giữ `source` trong khoá.** Không xoá và không ghi đè dữ liệu `csv-demo`.
3. **Hợp đồng API v1 chỉ được thêm, không đổi tên hay xoá trường.** Giao diện đang dùng: `marketCap`, `tradingValue`, `source`, `dataMode`, `asOf`, cấu trúc `reactions` (`status`, `methodVersion`, `dataMode`, `t1`/`t5` với `abnormalReturnPct` và `reason`), và `ai_enabled` của `/meta/data-sources`.
4. **Secret chỉ nằm ở backend và worker.** Không bao giờ dùng biến `NEXT_PUBLIC_*`, không commit `.env`, không in key ra log hay test. Fixture payload thật phải xoá key, chữ ký và mã tài khoản.
5. **Không dùng thư viện theo trí nhớ.** DNSE, SQLAlchemy 2, Pydantic v2, APScheduler 3 phải đọc tài liệu hoặc mã nguồn bản đã cài.
6. **Đơn vị:** giá cổ phiếu lưu bằng **đồng** (đã nhân hệ số); điểm chỉ số giữ nguyên; `dividend_yield` lưu dạng phân số. Mọi hệ số phải lấy từ tài liệu hoặc payload thật, không đoán.
7. **Không gọi là "AI"** những gì là heuristic. Không có khuyến nghị đầu tư trong bất kỳ chuỗi API nào.
8. Test CI không được cần mạng hay secret: mọi test provider chạy bằng fixture.

## 4. Mức model (tiết kiệm token)

| Mức | Dùng cho | Gợi ý |
|---|---|---|
| **Mạnh** | Đọc tài liệu nhà cung cấp và viết spec, thiết kế migration hoặc phương pháp giá điều chỉnh, rà soát bảo mật | Model mạnh nhất của Codex, mức suy luận cao. Tương đương Claude Opus |
| **Trung** | Code theo spec đã rõ, viết test, sửa lỗi test | Model mặc định của Codex, mức suy luận vừa. Tương đương Claude Sonnet |
| **Nhỏ** | Sửa cấu hình, thêm biến môi trường, cập nhật tài liệu, chạy lệnh và tóm tắt kết quả | Model nhỏ hoặc nhanh nhất, mức suy luận thấp. Tương đương Claude Haiku |

Quy tắc: mức mạnh không gõ code dài, chỉ viết spec và review. Mỗi task một phiên mới. Chạy lệnh dài thì chỉ đọc đuôi kết quả (`2>&1 | tail -30`).

---

## 5. Luồng 0: làm ngay

| Task | Việc | Mức | Đọc | Xong khi |
|---|---|---|---|---|
| BE-00 | Tạo `AGENTS.md` ở **gốc repo** (≤ 25 dòng): dự án là gì, đọc `docs/BACKEND_PLAN.md` mục 0–4 trước khi làm backend, đọc `docs/REDESIGN_PLAN.md` mục 2 trước khi đụng frontend, lệnh kiểm tra ở mục 7. Không sửa `frontend/AGENTS.md`. Tạo `docs/backend-log.md` rỗng có tiêu đề. | Nhỏ | `CLAUDE.md` | Hai file tồn tại |
| BE-01 | Sửa lỗi NaN: `_bars_for` bỏ qua hoặc để `None` cho từng trường thiếu thay vì ném lỗi; bar thiếu `close` thì bỏ bar, không bỏ cả mã. Thêm test trong `tests/test_price_normalization.py` cho NaN ở open/high/low/adjusted_close và cho `close` NaN. | Trung | `jobs/ingest_prices.py:29-77`, `tests/test_price_normalization.py` | Test mới xanh; một NaN không làm mã vào `failed_symbols` |
| BE-02 | Lớp gọi bền cho provider: tạo `providers/resilience.py` với `call_with_retry(fn, *args, attempts=3, base_delay=0.5, timeout_s=15, retry_on=(...))` (backoff mũ, có jitter, timeout bằng `asyncio.wait_for` quanh `to_thread`) và một bộ giới hạn tần suất theo token bucket (`requests_per_minute` cấu hình được). `ingest_prices` dùng hai thứ này thay `request_delay_seconds` cố định. Thêm `PROVIDER_RPM` vào Settings (mặc định 60). | Trung | `jobs/ingest_prices.py:79-226`, `core/config.py` | Test: hàm lỗi 2 lần rồi thành công thì trả kết quả; lỗi 3 lần thì ném lỗi; timeout hoạt động; giới hạn tần suất đo được bằng đồng hồ giả |
| BE-03 | Endpoint `GET /api/v1/market/indices/{symbol}/history?limit=` (VNINDEX, HNXINDEX, UPCOMINDEX), đọc `index_bars` của source đang cấu hình, trả cùng dạng với `/stocks/{symbol}/history` (`candles`, `source`, `dataMode`, `asOf`). Mã lạ trả 404 `SYMBOL_NOT_FOUND`. Thêm hàm `getIndexHistory` trong `frontend/lib/api.ts` (chỉ thêm, không sửa hàm khác). | Trung | `api/v1/stocks.py:184-262` (làm mẫu), `api/v1/market.py`, `frontend/lib/api.ts` (grep `getStockHistory`) | Test hợp đồng trong `tests/test_api_contract.py`; OpenAPI có route mới |
| BE-04 | `conftest.py` cho `backend/tests/`: fixture `db_session` (transaction rollback sau mỗi test), `client` (TestClient), `seed_symbols`. Tạo `tests/fixtures/` và helper `load_fixture(name)` đọc JSON. Chuyển dần 2 file test tích hợp sang fixture mới, không đổi logic test. | Trung | `tests/test_account_integration.py`, `tests/test_api_contract.py` (phần setup) | `pytest tests -q` xanh như trước; độ phủ `domain` ≥ 80% |
| BE-05 | Dọn API cũ. (a) Liệt kê caller của 21 route cũ (`rg` trong `frontend/`), ghi bảng vào `docs/decisions.md`. (b) Thêm route v1 tương đương cho những route còn được dùng: `GET /api/v1/meta` (gồm `ai_enabled` và mô tả nguồn), `GET /api/v1/market/status`; `/market/top-movers` thay bằng `/api/v1/market/movers` đã có; AI chuyển thành `POST /api/v1/ai/explain` và `POST /api/v1/ai/chat`. (c) Sửa `frontend/lib/api.ts` gọi route v1 qua proxy `frontend/app/api/v1/[...path]`. (d) Xoá route cũ và route proxy cũ trong `frontend/app/api/*` không còn caller. Giữ `/`, `/health`, `/ready`. | Trung | `main.py:164-287`, `frontend/lib/api.ts` (grep `'/api/`), `frontend/app/api/*` | `rg "'/api/(market\|meta\|ai\|stock\|quote\|news)/" frontend/lib` rỗng; frontend `npm run lint` và `npm run build` qua; backend test xanh |
| BE-06 | Cấu hình: Compose truyền `JWT_SECRET`, `CORS_ORIGINS`, `VNSTOCK_API_KEY`, `PROVIDER_RPM` cho backend và worker từ `.env`; `render.yaml` thêm các khoá còn thiếu cho worker (`JWT_SECRET` không cần cho worker); `.env.example` thêm `PROVIDER_RPM` và các khoá DNSE để trống (`DNSE_API_KEY`, `DNSE_API_SECRET`). Backend báo lỗi khi khởi động nếu `ENVIRONMENT=production` mà `JWT_SECRET` còn giá trị dev. | Nhỏ | `docker-compose.yml`, `render.yaml`, `.env.example`, `core/config.py` | `docker compose config` không lỗi; test kiểm tra JWT dev ở production |
| BE-07 | Rà soát bảo mật trước deploy (không sửa, chỉ báo): secrets, CORS, rate limit đăng nhập, quyền sở hữu dữ liệu theo user ở account/portfolio/backtests, log có lộ token không, cookie refresh (`HttpOnly`, `Secure`, `SameSite`), kích thước body. Xuất `docs/security-review.md` với P0/P1/P2, mỗi mục file:dòng và cách sửa. | Mạnh | `api/v1/auth.py`, `api/v1/account.py`, `api/v1/backtests.py`, `main.py` (CORS, middleware) | File review có; P0 được tách thành task BE-08 |
| BE-08 | Sửa các P0 và P1 từ BE-07. | Trung | đúng file:dòng trong review | P0 = 0; test xanh |

## 6. Luồng 1: nguồn giá thật (DNSE)

**Điều kiện mở luồng:** chủ dự án đã có `DNSE_API_KEY`/`DNSE_API_SECRET` và trả lời bằng văn bản các câu hỏi ở BE-10. Thiếu một trong hai thì dừng ở BE-11.

| Task | Việc | Mức | Xong khi |
|---|---|---|---|
| BE-10 | **Việc của chủ dự án:** đăng ký DNSE OpenAPI; hỏi DNSE bằng văn bản: được lưu vào database và hiển thị cho người dùng không; EOD hay có độ trễ; quota mỗi phút/ngày; phí; lịch sử bao nhiêu năm; giá có điều chỉnh cổ tức/chia tách không; có dữ liệu sự kiện quyền và fundamentals không. Ghi câu trả lời vào `docs/decisions.md`. | Người | Có key và câu trả lời |
| BE-11 | Spec adapter: đọc tài liệu DNSE (danh mục API dữ liệu thị trường và trang xác thực API key/chữ ký HMAC) và SDK `dnse-sdk-openapi` nếu dùng. Ánh xạ từng hàm của `MarketDataProvider` sang endpoint DNSE; chỉ rõ header, cách ký, múi giờ, đơn vị giá (nghìn đồng hay đồng), phân trang, giới hạn khoảng ngày mỗi lần gọi, quota, mã lỗi; giá có điều chỉnh hay không; hàm nào DNSE không hỗ trợ thì trả gì. Ghi vào `docs/dnse-adapter-spec.md` (≤ 3 trang). Gọi thử bằng key thật **một lần** cho mỗi endpoint, lưu payload vào `backend/tests/fixtures/dnse/*.json` đã xoá thông tin nhạy cảm. | Mạnh | Spec và fixture có; mọi câu hỏi đơn vị và điều chỉnh đều có bằng chứng từ tài liệu hoặc payload |
| BE-12 | Code `backend/providers/dnse_provider.py` theo spec: `source_id = "dnse"`, `data_mode = "market-provider"`, ký request ở server, dùng `call_with_retry` và giới hạn tần suất của BE-02. Thêm `dnse` vào `factory.py` (cả `SOURCE_BY_PROVIDER`), Settings `dnse_api_key`, `dnse_api_secret` (SecretStr), Compose, Render, `.env.example`. Thêm gói vào `requirements.txt` nếu dùng SDK. | Trung | Unit test bằng fixture (không mạng): chuẩn hoá cột, đơn vị, múi giờ, phân trang, lỗi 401/429/5xx, chữ ký đúng với vector mẫu trong spec; `ruff` và `mypy` qua |
| BE-13 | Backfill thử: `MARKET_PROVIDER=dnse`, 15 mã hiện có + 3 chỉ số, 2 năm, qua `scripts/backfill.py` (thêm tham số `--symbols`, `--years` nếu chưa có). So 5 mã và VN-Index với trang chính thức (HOSE hoặc website DNSE) ở 3 ngày bất kỳ; ghi bảng so sánh vào `docs/decisions.md`. Kiểm tra ngày nghỉ, khoảng trống, volume. | Trung | Bảng so sánh khớp; `provider_job_runs` báo `success`; `/api/v1/market/data-status` báo source `dnse` |
| BE-14 | Giá điều chỉnh. Nếu DNSE trả giá điều chỉnh: ghi vào `adjusted_close` và xác nhận bằng một mã có chia tách hoặc cổ tức tiền trong 2 năm qua. Nếu không: thiết kế bảng `corporate_actions` (migration `0009`: symbol, ex_date, type, ratio/cash, source) và hàm thuần `domain/adjustment.py` tính hệ số điều chỉnh lùi; job tính `adjusted_close`. Nguồn dữ liệu sự kiện quyền phải được phép dùng (ghi rõ trong `decisions.md`). | Mạnh lập kế hoạch, Trung code | Test domain với ví dụ tính tay (chia tách 1:2, cổ tức tiền); `alembic upgrade head` rồi `downgrade -1` chạy được; mã kiểm tra có `adjusted_close` khác `close` đúng ngày |
| BE-15 | Event study trên dữ liệu thật: chạy `compute_event_studies` cho tin trong cửa sổ đã backfill; kiểm tra phân bố trạng thái; lấy 3 tin bất kỳ có `measured` và tính tay T+1 để đối chiếu. Đảm bảo `dataMode` của reaction là `market-provider` để giao diện hiện số. | Trung | Ít nhất 3 tin `measured` được đối chiếu tay khớp tới 0,01 điểm %; ghi vào `backend-log.md` |
| BE-16 | Fundamentals (nếu DNSE có): job `jobs/ingest_fundamentals.py` ghi `market_cap`, `pe`, `pb`, `eps`, `dividend_yield` (phân số) theo `as_of`; chạy hằng ngày sau EOD. Nếu DNSE không có: ghi rõ trong `decisions.md`, để null. | Trung | `/api/v1/stocks` trả `marketCap` khác null cho các mã đã backfill (bản đồ nhiệt dùng được tab Vốn hoá) |
| BE-17 | Cập nhật `README.md` (biến môi trường, cách đổi provider), `docs/PROJECT_HANDOFF.md` mục 4, 10–13, `backend/VNSTOCK_SETUP.md` (ghi vnstock là tuỳ chọn, PyPI đã cách ly gói từ 24/9/2026). | Nhỏ | Tài liệu khớp với code |

## 7. Lệnh kiểm tra cho mỗi task

Chạy trong thư mục `backend/`, với Postgres từ Compose (`docker compose up -d db redis`):

```bash
ruff check . 2>&1 | tail -20
mypy domain --ignore-missing-imports 2>&1 | tail -10
alembic upgrade head
pytest tests -q --cov=domain --cov-fail-under=80 2>&1 | tail -25
```

Task có migration thêm: `alembic downgrade -1 && alembic upgrade head`.
Task đụng `frontend/`: trong `frontend/` chạy `npm run lint`, `npm test`, `npm run build`.
Task đụng API: mở `http://localhost:8000/docs` hoặc `curl` route mới, dán kết quả rút gọn vào `backend-log.md`.

## 8. Checklist cho reviewer

- [ ] Commit đúng phạm vi task, message `BE-xx: …`, có mục trong `docs/backend-log.md`
- [ ] Không đổi tên hay xoá trường API v1 đang được giao diện dùng (mục 3.3)
- [ ] Không có secret trong diff, fixture hoặc log; không có biến `NEXT_PUBLIC_*` mới
- [ ] Không có nhánh code nào âm thầm quay về CSV
- [ ] Đơn vị giá, múi giờ và giá điều chỉnh có bằng chứng (tài liệu hoặc payload), không đoán
- [ ] Test mới chạy không cần mạng; CI xanh; độ phủ `domain` ≥ 80%
- [ ] Migration có downgrade và không làm mất dữ liệu đang có

## 9. Thứ tự

```
Luồng 0: BE-00 → BE-01 → BE-02 → BE-03 → BE-04 → BE-05 → BE-06 → BE-07 → BE-08
Luồng 1 (khi có key + văn bản): BE-10 → BE-11 → BE-12 → BE-13 → BE-14 → BE-15 → BE-16 → BE-17
```

BE-10 nên được chủ dự án làm ngay từ bây giờ, vì chờ phản hồi mất thời gian.

## 10. Prompt mẫu mở phiên Codex

```
Đọc docs/BACKEND_PLAN.md mục 0–4 và task <MÃ TASK>. Không đọc mục khác.
Chỉ mở file trong cột "Đọc"; cần thêm thì rg -n ra đúng dòng.
Làm xong: chạy lệnh mục 7, commit "<MÃ TASK>: <mô tả>", thêm mục vào docs/backend-log.md, báo cáo ≤ 10 dòng.
```

## 11. Câu hỏi mở (agent dùng mặc định nếu chưa có trả lời)

- Nguồn chính: mặc định DNSE; đổi sang SSI FastConnect nếu BE-10 cho kết quả tốt hơn (khi đó BE-11, BE-12 làm cho SSI).
- Phạm vi mã: mặc định 15 mã đang có và 3 chỉ số; mở rộng VN30 sau BE-15 nếu quota cho phép.
- vnstock: giữ adapter làm tuỳ chọn, không đưa vào Docker mặc định.
- Lịch sử: mặc định 2 năm; 5 năm chỉ khi BE-10 xác nhận quota.
