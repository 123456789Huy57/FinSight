# FinSight – Kế hoạch triển khai Fullstack giai đoạn 2

*Tài liệu bàn giao cho agent thực thi. Đọc toàn bộ trước khi sửa code. Kế hoạch này gộp backend và frontend, lấy repo hiện tại làm mốc; không giả định các phần đã có phải viết lại.*

**Ngày lập:** 06/11/2026  
**Phạm vi:** hoàn thiện pipeline dữ liệu thị trường và tin, API phục vụ sản phẩm, rồi nối `/market`, `/news`, `/stock/[symbol]`.  
**Ngoài phạm vi giai đoạn này:** đặt lệnh, tư vấn đầu tư, realtime công khai cho người dùng, mua dữ liệu thương mại khi chưa có duyệt chi phí/điều khoản.

## 1. Mục tiêu và nguyên tắc

FinSight phải đưa ra được câu trả lời kiểm chứng được cho ba câu hỏi:

1. Dữ liệu này đến từ đâu, được cập nhật lúc nào, và có phải dữ liệu minh hoạ không?
2. API nào là nguồn chuẩn để frontend hiển thị một mã, một cây giá, một tin và các chỉ báo của chúng?
3. Khi một tin gắn với biến động giá, phép đo được tính thế nào và có đủ dữ liệu để diễn giải không?

Nguyên tắc triển khai:

- Backend/PostgreSQL là nguồn chuẩn của sản phẩm. Frontend đọc qua `frontend/lib/api.ts` và Next.js proxy; trang không tự tạo chuỗi giá hoặc import dữ liệu demo riêng.
- Provider là adapter có thể thay thế. CSV synthetic dùng cho demo/CI; không được âm thầm dùng thay provider thật khi provider thật lỗi.
- Mọi response có số liệu phải có provenance phù hợp: `source`, `asOf` và `dataMode`/trạng thái dữ liệu. Chỉ dữ liệu synthetic mới gắn nhãn “Dữ liệu minh hoạ”.
- Không bịa giá, fundamentals, tin, hoặc phản ứng T+1/T+5. Thiếu dữ liệu thì trả `null`/trạng thái rỗng rõ ràng.
- “Phản ứng giá” là biến động quan sát được sau thời điểm tin, không chứng minh tin gây ra biến động. Không đưa khuyến nghị mua/bán.
- Giữ UI tokens, font, màu ngữ nghĩa, nội dung tiếng Việt và tiêu chí responsive đã nêu trong tài liệu frontend bàn giao. Không tự mở rộng phạm vi.

## 2. Hiện trạng repo cần giữ làm mốc

Đây là danh sách ban đầu từ việc đọc repo; F0 phải xác nhận chi tiết và cập nhật nếu phát hiện khác.

### Backend đã có

- FastAPI, API v1 cho market, stocks, news, auth, account và backtests.
- SQLAlchemy async, PostgreSQL, Alembic; bảng `symbols`, `price_bars`, `index_bars`, `fundamentals`, `news_articles`, `news_symbols` và tài khoản.
- Provider contract `backend/providers/base.py`; factory hiện hỗ trợ `vnstock` và `csv`.
- Worker/job ingest symbols, giá và tin; RSS sentiment baseline; domain indicators, signals, portfolio và backtest.
- Docker Compose có PostgreSQL, Redis, backend, worker và frontend; Compose mặc định `MARKET_PROVIDER=csv`.

### Frontend đã có

- Next.js App Router, API client ở `frontend/lib/api.ts` và proxy `/api/v1/[...path]`.
- Đã có trang `/market`, `/news`, `/stock/[symbol]`, cùng trang `/stock` tương thích cũ.
- Có thêm account/backtest và các route API cũ; cần kiểm kê route nào còn được gọi để tránh xoá nhầm.

### Khoảng trống cần xác nhận ở F0

- Chưa có provider DNSE/SSI; danh sách provider thực tế chỉ có vnstock/CSV.
- Model tin hiện lưu URL, nguồn, tiêu đề, summary, thời điểm, category, sentiment và quan hệ mã; chưa có dữ liệu phản ứng/event-study đã chuẩn hoá.
- Bảng `price_bars` lưu `source`, nhưng cần xác nhận tính nhất quán provenance, cập nhật lặp lại và độ mới của dữ liệu ở mọi endpoint.
- `frontend/lib/api.ts` có nhiều kiểu response snake_case và camelCase; cần lập mapping hợp đồng hiện trạng trước khi đổi.
- Bộ dữ liệu demo backend hiện có các CSV symbols, quotes, index và lịch sử cho một tập mã nhỏ. Không mặc định nó bằng 84 mã của heatmap frontend.
- `CLAUDE.md` có nội dung cũ về vnstock 4 và phase trước; README và mã hiện tại là nguồn tham khảo mới hơn. Cập nhật tài liệu mâu thuẫn trong giai đoạn dọn dẹp.

## 3. Quyết định dữ liệu cần qua cổng xác nhận

### 3.1 Ứng viên giá/thị trường

| Ứng viên | Vai trò đề xuất | Cần xác minh trước khi chọn |
|---|---|---|
| DNSE OpenAPI | Ứng viên thử nghiệm cho giá lịch sử và dữ liệu thị trường; WebSocket chỉ là giai đoạn sau nếu thật sự cần | Quyền truy cập theo tài khoản, điều khoản lưu/hiển thị, phí, quota, độ dài lịch sử, mã/sàn được hỗ trợ và hành vi khi mất kết nối |
| SSI FastConnect Data | Ứng viên thử nghiệm cho EOD/realtime, thông tin mã/chỉ số và streaming | Đăng ký/key, quota theo endpoint/key, phí, quyền lưu/hiển thị, độ dài lịch sử và coverage |
| vnstock 5 | Giữ làm adapter tùy chọn nếu cài đặt và điều khoản phù hợp | Cài đúng package index trên CI/deploy, version, license hiện hành, quota thực tế, dữ liệu nguồn và quyền sử dụng nguồn đó |
| CSV synthetic | Demo, CI và phát triển offline | Gắn `dataMode=synthetic-demo`; không dùng làm fallback ngầm cho dữ liệu thật |
| KBS/VCI gọi trực tiếp không có hợp đồng API | Không chọn làm nguồn production mặc định | Chỉ xem xét nếu có tài liệu, quyền sử dụng và độ ổn định được xác nhận |

Tài liệu tham khảo chính thức đã kiểm tra khi lập kế hoạch:

- [DNSE OpenAPI – dữ liệu thị trường](https://developers.dnse.com.vn/docs/dnse/market-data/) và [Market Data WebSocket](https://developers.dnse.com.vn/docs/guide/market-data/connect/).
- [SSI FastConnect Data](https://guide.ssi.com.vn/ssi-products/fastconnect-data), [đăng ký, key và giới hạn](https://guide.ssi.com.vn/ssi-products/general-information).
- [PyPI vnstock](https://pypi.org/project/vnstock/) và [README/điều khoản vnstock](https://github.com/thinh-vu/vnstock/blob/main/README.md).

Trang PyPI hiện liệt kê các bản phát hành vnstock 4.x/vnai; repo cài vnstock 5 qua package index của dự án. Vì vậy không đưa vào plan như sự thật rằng “vnstock đã bị cách ly khỏi PyPI” hoặc “pip install chắc chắn thất bại”. F1 phải kiểm tra cài đặt chính xác theo `requirements.txt` trong môi trường CI/deploy và ghi nhận kết quả. Không coi giới hạn request hay quyền phân phối dữ liệu là đã xác nhận cho tới khi có tài liệu/hợp đồng của nguồn.

### 3.2 Quy tắc chọn nguồn

F1 tạo một bảng đánh giá có bằng chứng cho từng nguồn, không chọn theo trí nhớ. Ưu tiên tiêu chí theo thứ tự:

1. Điều khoản cho phép mục đích sử dụng, lưu và hiển thị của FinSight.
2. Cài đặt và xác thực được trong môi trường triển khai dự kiến.
3. Coverage mã/sàn, lịch sử cần dùng và các trường dữ liệu thực tế.
4. Quota, phí, độ ổn định, khả năng lấy dữ liệu lại và mức công tích hợp.

Chỉ tích hợp **một nguồn thật chính** trong giai đoạn này; giữ CSV cho demo. Chọn nguồn thứ hai làm production fallback chỉ khi điều khoản tương thích và schema/giá có thể chuẩn hoá. Nếu chưa xác nhận được quyền truy cập hoặc chi phí, tiếp tục chạy CSV demo và ghi rõ quyết định còn mở.

### 3.3 Tin và sự kiện

- News/RSS và công bố thông tin chính thức là pipeline riêng với pipeline giá.
- Mỗi bài có nguồn, URL, thời gian xuất bản, thời gian ingest, mã liên quan và phương pháp sentiment.
- Xác minh feed còn hoạt động, điều khoản sử dụng, khả năng truy cập ổn định và quy tắc attribution trước khi đưa vào production.
- Sentiment từ từ khoá phải ghi là heuristic/baseline; không gọi là AI.

## 4. Hợp đồng dữ liệu mục tiêu

Không đổi toàn bộ API hiện có một lần. F0 ghi lại response hiện tại; F2 bổ sung tương thích hoặc lập phiên bản thay đổi có lý do.

### Metadata chung

- `source`: provider/feed tạo dữ liệu, ví dụ `csv-demo`, `dnse`, `ssi`, `vnstock`, `rss:<publisher>`.
- `dataMode`: tối thiểu `synthetic-demo` hoặc `market-provider`.
- `asOf`: thời điểm giao dịch/xuất bản mới nhất mà response đại diện; nếu không xác định được thì `null`.
- `ingestedAt` hoặc trạng thái mới cũ: thời gian backend nhận/lưu; không lấy giờ server làm giờ thị trường.
- Lỗi/thieu dữ liệu phải phân biệt với số 0. Không trả chuỗi giả hoặc quote demo khi provider lỗi.

### Nghiệp vụ

- Symbol: mã, tên, sàn, ngành khi provider có dữ liệu đáng tin; metadata thiếu giữ `null`.
- Price/index bar: ngày giao dịch, OHLCV, đơn vị giá chuẩn thống nhất, nguồn và chế độ dữ liệu.
- News article: id, title, summary, source, URL, `publishedAt`, `ingestedAt`, category, sentiment/method, related symbols.
- Event window: article id, symbol/benchmark, mốc tham chiếu, T+1/T+5 return, abnormal return nếu đủ benchmark, trạng thái dữ liệu và phiên bản phương pháp.
- Fundamentals giữ `asOf`/source; không trộn snapshot khác ngày thành một bộ số liệu “hiện tại”.

## 5. Milestones

Mỗi milestone kết thúc bằng diff nhỏ, cập nhật tài liệu quyết định và báo cáo tiêu chí đạt/chưa đạt. Không chuyển milestone khi gate của milestone trước chưa được giải quyết.

### F0 — Audit và đặc tả thực thi

**Công việc**

- Kiểm tra từng endpoint/API client, migration, worker, seed data, provider, trang và component đang được dùng.
- Ghi inventory: endpoint → response → nguồn DB/job → màn hình tiêu thụ; đánh dấu mock, route cũ, dữ liệu thiếu.
- Chạy thử stack hiện hữu chỉ để xác nhận cách khởi động và lỗi nền; không sửa feature trong bước audit.
- So sánh attachment frontend plan với repo hiện tại; chuyển các ràng buộc đúng vào tài liệu này và xoá giả định lỗi thời.
- Lập bảng coverage dữ liệu cần cho `/market`, `/news`, `/stock/[symbol]`.

**Xong khi**

- Có danh sách chính xác phần đã làm/chưa làm và phụ thuộc giữa frontend/backend.
- Không còn việc nào trong milestone sau dựa trên giả định rằng route/provider/model chưa tồn tại nếu chúng đã có.

### F1 — Thử nghiệm nguồn và quyết định provider

**Công việc**

- Tạo spike nhỏ tách khỏi feature: cài và truy vấn thử từng ứng viên khả thi (DNSE, SSI, vnstock) cho một tập mã đại diện HOSE/HNX/UPCoM nếu nguồn hỗ trợ.
- Kiểm tra ít nhất: listing, quote hoặc daily bar, lịch sử đủ cho nhu cầu UI, chỉ số, timezone/đơn vị giá, lỗi/quota và khả năng chạy từ worker.
- Thu thập điều khoản/chi phí/giới hạn từ tài liệu chính thức hoặc xác nhận nhà cung cấp; ghi rõ điểm chưa xác minh.
- Chọn một provider chính cho dữ liệu thật hoặc ghi quyết định tiếp tục CSV synthetic cho giai đoạn demo.
- Không lưu secret trong repo/log; cấu hình qua environment.

**Xong khi**

- `docs/decisions.md` có bảng so sánh và quyết định có bằng chứng.
- Có lệnh kiểm tra lặp lại được và kết quả mẫu đã loại bỏ thông tin nhạy cảm.
- Không có claim “realtime”, coverage, quota hoặc license nếu chưa được xác nhận.

### F2 — Chuẩn hoá provider, ingest và provenance

**Công việc**

- Mở rộng `backend/providers/base.py` khi cần và thêm adapter đã chọn vào factory; giữ `CsvSeedProvider`.
- Chuẩn hoá symbol, exchange, đơn vị giá, timezone, ngày giao dịch, volume và index.
- Rà soát `backend/jobs/ingest_prices.py`, `ingest_symbols.py`, worker và seed: idempotency, phạm vi mã, giới hạn concurrency, timeout/retry có backoff.
- Lưu đúng `source`, `asOf` và chế độ synthetic/thật. Nếu cần, thêm migration cho provenance, provider run/health hoặc event metadata; không ghi đè dữ liệu của nguồn khác mà mất xuất xứ.
- Bổ sung kiểm tra freshness và trạng thái job; phân biệt không có dữ liệu, provider lỗi và dữ liệu stale.
- Xác nhận Compose vẫn chạy demo offline; provider thật lỗi không được chuyển sang CSV ngầm.

**Xong khi**

- Ingest chạy lặp lại không sinh duplicate, đổi nguồn vẫn truy vết được nguồn từng bản ghi.
- `/ready` hoặc endpoint trạng thái phân biệt DB/Redis/job/provider theo cấu hình.
- Dữ liệu synthetic và market-provider không bị trộn không dấu vết.

### F3 — API v1 và mapping frontend

**Công việc**

- Chốt response schemas cho overview, indices, screener/search, stock profile/history/indicators, news và metadata nguồn.
- Giữ tương thích với endpoint đang dùng; sửa snake_case/camelCase qua mapping tập trung trong `frontend/lib/api.ts`.
- Bổ sung/hoàn thiện query lọc và phân trang cho mã/ngành/sàn/tin; tìm tiếng Việt không dấu ở lớp phù hợp.
- Đảm bảo history, quote, index và heatmap lấy cùng nguồn/bản ghi và cùng giá cuối.
- Trả `asOf`, `source`, `dataMode` và lỗi/thieu dữ liệu nhất quán.
- Bổ sung endpoint aggregate cần cho dashboard/screener nếu chưa tồn tại thay vì tính khác nhau ở từng trang.

**Xong khi**

- API docs có ví dụ cho demo và provider thật.
- Frontend lấy danh sách, giá, history và trạng thái qua API v1; không còn mock riêng cho cùng một mã.
- Một symbol có giá/change thống nhất giữa dashboard, market, heatmap và trang chi tiết.

### F4 — Tin tức, mã liên quan và dữ liệu sự kiện

**Công việc**

- Rà soát `backend/jobs/ingest_news.py`, `NewsArticle`, `NewsSymbol`, RSS URL và deduplication.
- Chỉ bật feed đã được kiểm tra; chuẩn hoá timezone, publication date, URL canonical, nguồn và lỗi parse.
- Phân loại category/sentiment có `method`/version; heuristic ghi nhãn rõ.
- Gắn mã liên quan với kiểm soát false positives (mã trùng từ thường hoặc trùng tên); cho phép bài không có mã.
- Lập chính sách retention/attribution dựa trên điều khoản feed; không sao chép nội dung đầy đủ nếu nguồn không cho phép.
- Chưa tính T+1/T+5 tại bước này nếu chưa chốt phương pháp ở F5.

**Xong khi**

- Ingest lặp lại không nhân đôi bài; article trả đúng URL, nguồn, thời điểm, related symbols và trạng thái sentiment.
- Có fixture/kiểm tra cho feed rỗng, dữ liệu sai, bài trùng và timezone.

### F5 — Phương pháp event study T+1/T+5

**Công việc**

- Viết đặc tả phương pháp trước khi code: thời điểm sự kiện, ngoài/giữa phiên, ngày không giao dịch, phiên T, T+1 và T+5.
- Xác định close nào được dùng, xử lý corporate action/giá điều chỉnh và benchmark (VN-Index hoặc chỉ số ngành nếu đáng tin).
- Tính return quan sát và abnormal return theo công thức công khai; lưu `methodVersion`, `asOf`, giá nguồn, benchmark, trạng thái window và số mẫu.
- Xử lý event overlap, tin cũ/sửa ngày, thiếu bar và các sự kiện trùng mã; không ép gán phản ứng cho tin khi không đủ dữ liệu.
- API trả `pending`, `insufficient_data` hoặc giá trị đo được; không bịa số từ synthetic data để giả thực nghiệm.
- Khi cần nhóm “tin tương tự”, chỉ trả tổng hợp nếu tiêu chí tương tự và sample size đã định nghĩa; hiển thị N và khoảng thời gian.

**Xong khi**

- Có ví dụ tính tay trên fixture nhỏ, kiểm tra ngày giao dịch và benchmark.
- Văn bản giao diện gọi đây là biến động quan sát/ước lượng, không phải quan hệ nhân quả hay khuyến nghị.
- Mỗi kết quả truy được article, bars, benchmark và version phương pháp.

### F6 — Frontend `/market`, `/news`, `/stock/[symbol]`

**Nền dùng chung**

- Tạo/hoàn thiện shared components và formatters sau khi thống nhất API; chỉ giữ một API client.
- Dùng UI tokens/font đã chốt; màu tăng/giảm chỉ biểu thị giá; không dùng ảnh stock hoặc màu trang trí ngoài hệ thống.
- Hiển thị “Dữ liệu minh hoạ” với CSV synthetic; với dữ liệu thật hiển thị nguồn và thời điểm cập nhật.

**`/market`**

- Tìm theo mã/tên, hỗ trợ tiếng Việt không dấu; lọc ngành/sàn và giữ state trên query string.
- Bảng HTML thật, sắp xếp có `aria-sort`; mobile 390px hiện mã/tên, giá, % mà không cuộn ngang.
- Tăng/đứng/giảm và weighted average được tính từ cùng universe/quote snapshot; ghi cách tính nếu mẫu bị lọc.
- Bấm mã mở `/stock/[symbol]`; mã và giá khớp heatmap.

**`/news`**

- Danh sách dạng hàng, không hotlink ảnh; lọc query string theo text/category/sentiment/symbol.
- Hiện nguồn, thời gian, URL, mã liên quan, sentiment có nhãn phương pháp.
- T+1/T+5 chỉ hiển thị khi event API có trạng thái hợp lệ; bài chưa đủ phiên ghi “Chờ”, thiếu dữ liệu ghi trạng thái tương ứng.
- Tin mở rộng có phần giải thích phương pháp và link gốc; không tuyên bố tin gây biến động.

**`/stock/[symbol]`**

- Route động hiện đúng mã; symbol không tồn tại trả 404; route cũ `/stock` chuyển hướng hoặc tương thích có chủ đích.
- Chart dùng history từ API, khoảng thời gian và news pins đúng mã/đúng ngày.
- Hiệu suất và indicators tính từ cùng chuỗi giá; ngưỡng/method hiển thị, không có “Khuyến cáo: MUA” hay nhãn Buy/Sell.
- Fundamentals chỉ hiện khi API có dữ liệu và `asOf`; trường thiếu ghi “Chưa có dữ liệu”.
- Theo dõi giữ theo lựa chọn đã chốt: hiện backend có account/watchlist; F0 quyết định dùng account hay localStorage để tránh hai nguồn khác nhau.

**Xong khi**

- Trang không tự import dataset demo và không hardcode số liệu thị trường.
- Các mã/số thống nhất giữa trang; không có khuyến nghị mua/bán; lỗi/empty/loading có trạng thái rõ.

### F7 — Kiểm chứng tích hợp, triển khai và tài liệu

**Công việc**

- Kiểm tra test backend hiện có và bổ sung test cho contract/provider/ingest/event-study/API; chạy test phù hợp sau thay đổi.
- Chạy lint/build frontend và kiểm tra trang ở 1440×900, 390×844; xem ảnh, scrollWidth, keyboard focus và reduced motion.
- Kiểm tra compose demo sạch, migrate từ DB mới, worker ingest, lỗi provider, stale data, readiness và API proxy.
- Rà secrets, CORS, JWT, environment production, log không chứa key; xác nhận quy trình rollback migration/deploy.
- Cập nhật `README.md`, `backend/VNSTOCK_SETUP.md`, `docs/decisions.md`, `.env.example` và sơ đồ pipeline.
- Chỉ xoá component/route/data legacy khi `rg`/dependency scan chứng minh không còn import hoặc caller.

**Xong khi**

- Các gate kiểm thử/build/visual và deploy demo qua; dữ liệu demo được nhận diện chính xác.
- README mô tả cách chạy demo, cấu hình provider thật, migrations, worker, nguồn/giới hạn và cách khắc phục lỗi.
- Không có secret thật hoặc claim dữ liệu không được chứng minh trong docs/UI.

## 6. Quy trình kiểm tra cho mỗi milestone

- Chạy test/lint/build liên quan đến phần vừa đổi; ghi lệnh và kết quả trong handoff.
- Backend: kiểm tra schema response, unknown symbol, empty/stale/error, timezone, duplicate ingestion và data provenance.
- Frontend: chụp 1440×900 và 390×844 cho trang sửa; kiểm tra `document.documentElement.scrollWidth === innerWidth`, tab order, focus visible, reduced motion và tương phản.
- Kiểm tra bằng một symbol xuyên suốt từ API → DB → dashboard/heatmap → market → stock → news/event.
- Không thêm màu hex trong component ngoài token đã chốt; không có dữ liệu giả không nhãn hoặc chữ khuyến nghị mua/bán.
- Nếu milestone phát hiện quyết định nguồn/phương pháp không hợp lệ, dừng milestone phụ thuộc đó, cập nhật `docs/decisions.md` và báo cáo rủi ro cụ thể.

## 7. Các quyết định mặc định và còn mở

Để agent có thể bắt đầu F0/F1 mà không chờ thêm câu trả lời:

- **Nguồn thật:** chưa chốt. Thử DNSE, SSI và vnstock theo F1; không coi vnstock là đủ cho toàn bộ sản phẩm.
- **Demo:** tiếp tục CSV synthetic hiện có, gắn nhãn rõ; không mở rộng 84 mã frontend bằng dữ liệu tự sinh trước khi đối chiếu phạm vi với backend.
- **Realtime:** ngoài phạm vi. F1 chỉ xác nhận khả năng và điều kiện; giai đoạn này ưu tiên EOD/giá lịch sử cho ổn định.
- **Tin → giá:** chỉ làm sau khi chốt phương pháp F5; không dùng giá synthetic cho con số tác động được trình bày như nghiên cứu thật.
- **Watchlist:** ưu tiên API account/watchlist đã có nếu yêu cầu là đồng bộ người dùng; localStorage chỉ dùng nếu sản phẩm chủ ý hỗ trợ khách chưa đăng nhập. Quyết định cuối được ghi ở F0.
- **Fundamentals:** chỉ hiện trường có nguồn và ngày hiệu lực; không bắt buộc nhà cung cấp giá phải cung cấp mọi chỉ tiêu.
- **Đánh giá hiệu quả:** kế hoạch không bao gồm backtest mới; backend backtest hiện có được giữ và chỉ sửa nếu audit cho thấy nó cản trở mục tiêu giai đoạn 2.

## 8. Quy tắc bàn giao cho agent

1. Đọc milestone hiện tại và `docs/decisions.md` trước khi sửa.
2. Làm tuần tự F0 → F7; milestone sau phụ thuộc vào gate milestone trước.
3. Trước mỗi milestone, nêu file/phần sẽ đổi và tiêu chí đạt; sau milestone, tóm tắt diff, lệnh kiểm tra, kết quả và điểm lệch plan.
4. Không thêm thư viện/UI/data provider ngoài plan nếu chưa ghi lý do và tác động vào `docs/decisions.md`.
5. Không để frontend gọi thẳng nhà cung cấp, không đưa secret tới browser, không đổi dữ liệu thật thành demo khi upstream lỗi.
6. Nếu quyền truy cập, giá hoặc điều khoản nguồn chưa xác nhận, báo rõ và giữ CSV demo; không tự suy diễn rằng được phép dùng.
