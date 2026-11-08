# Backend task log

## BE-00 — hướng dẫn làm backend
- Tạo `AGENTS.md` ở gốc repo và nhật ký này.
- Kiểm tra: hai file có mặt; chưa cần chạy test cho thay đổi tài liệu.

## BE-01 — chuẩn hoá giá thiếu dữ liệu
- NaN ở open/high/low/adjusted close được để null; bar thiếu close bị bỏ, không làm hỏng cả mã.
- Kiểm tra: 7 test chuẩn hoá giá qua; Ruff qua.
- Chưa chạy test tích hợp vì Docker Engine/PostgreSQL chưa hoạt động.

## BE-VN — chuẩn bị Vnstock Community cục bộ
- Cho phép cài gói tùy chọn vào Compose; dùng key Community từ `.env` và volume chung giữ mã thiết bị.
- Giới hạn mặc định 15 mã; nghỉ 6 giây giữa lần lấy lịch sử cổ phiếu; lưu close VCI đã điều chỉnh bằng đồng.
- Kiểm tra: 32 unit test qua; Ruff và `docker compose config --quiet` qua.
- Gọi thử FPT và VNINDEX qua Vnstock 5.2.1 ở cấp Khách: đều trả 7 nến, nguồn VCI/KBS.
- Còn chặn: danh sách mã đòi key Community; Docker Engine chưa chạy. Full pytest chưa chạy xong.
- `mypy domain` còn 2 lỗi có sẵn tại `domain/event_study.py:174,184`.

## BE-VN — xác minh chạy cục bộ với key Community

- Xác nhận `.env` có `VNSTOCK_API_KEY` (không ghi giá trị vào log); `docker compose up --build -d` chạy thành công.
- Worker đồng bộ thành công 15 mã (7.455 nến) và 3 chỉ số (1.490 nến); `/api/v1/market/data-status` báo `current`, nguồn `vnstock`, giá và chỉ số đến ngày 2026-11-06.
- `/api/v1/stocks/FPT` trả giá 50.800 đồng từ `vnstock`; endpoint lịch sử FPT trả 2 bản ghi và endpoint chỉ số trả 3 chỉ số. Frontend `/`, `/market`, `/news`, `/stock/FPT` đều HTTP 200.
- `python -m pytest tests -q --cov=domain --cov-fail-under=80` trong backend container: 40 qua, 2 lỗi, coverage 87,87%. Hai lỗi do test còn giả định nguồn `csv-demo` và tin tức tắt, trong khi môi trường chạy đang dùng `vnstock` và bật tin tức. Lệnh `pytest` trực tiếp còn lỗi import; dùng `python -m pytest` để chạy đúng.

## BE-02 — gọi provider bền hơn
- Thêm retry, timeout, token bucket và `PROVIDER_RPM`; giữ nhịp Vnstock 6 giây, dừng ngay khi có lỗi quyền/hạn mức.
- 14 test liên quan và Ruff qua. Timeout chặn thời gian chờ nhưng Python không thể dừng thread đồng bộ đã chạy.

## BE-03 — lịch sử chỉ số
- Thêm `/api/v1/market/indices/{symbol}/history` và `getIndexHistory`; test hợp đồng và OpenAPI qua.

## BE-04 — fixture và test độc lập môi trường
- Thêm `conftest.py`, JSON fixture, session rollback; test auth/backtest/news không còn giả định cấu hình CSV hay dữ liệu VCB đã có.
- Full backend suite với Postgres và cấu hình Vnstock: 60/60 qua, coverage `domain` 87,87%.

## BE-05 — dọn route API cũ
- Chuyển caller sang proxy `/api/v1`, thêm meta/status/AI v1 và xoá 21 route backend cũ cùng các proxy frontend không còn dùng.
- Frontend lint (1 warning có sẵn), 11 test và build qua; test route v1 qua.

## BE-06 — cấu hình
- Compose/Render và `.env.example` nhận các biến còn thiếu; production từ chối JWT secret mặc định/yếu.
- `docker compose config --quiet`, Ruff và test cấu hình qua.

## BE-07/08 — rà soát và sửa bảo mật
- Review ở `docs/security-review.md`: không có P0; bốn P1 về rate limit auth, Redis fail-open, body quá lớn và JWT yếu.
- Đã sửa bốn P1, thêm test trực tiếp cho rate limit và body streaming; còn ba P2 trong review để xử lý sau.

## BE-VN-FULL — toàn bộ mã đang giao dịch
- `VNSTOCK_SYMBOLS=ALL`: nhập 1.516 mã HOSE/HNX/UPCOM, bỏ 239 mã DELISTED; lưu checkpoint theo lô 50 mã.
- Sau khi khôi phục thiết bị Docker Vnstock, lô đầu nhập 50 mã/20.771 nến, không lỗi; các lô sau chạy nền, có ngưỡng giữ lại 20% quota.
- Migration 0009 upgrade → downgrade → upgrade qua trên database tạm; `mypy domain` và Ruff qua. T+1/T+5 chưa thể có ba tin `measured`: RSS hiện chỉ có tin 06–08/11, chưa đủ cửa sổ T+5.
- Bảng giá lấy tất cả trang API theo thứ tự mã, cho xem thêm từng 100 dòng và hiện số mã đã có giá trên 1.516 mã niêm yết. Kiểm tra Compose: 163 mã đã có giá; nút Xem thêm hiển thị đủ 163 dòng. Frontend lint (1 warning cũ), 12 test và build qua.

## BE-VN-FAST — bảng giá nhanh, tách khỏi lịch sử
- Worker lấy một quote KBS cho 1.516 mã mỗi 5 phút, lưu snapshot mới nhất; API `/api/v1/market/board` đọc PostgreSQL, không gọi provider theo lượt xem. Trang thị trường tải một request và lọc trên 1.516 mã; chỉ vẽ 100 dòng đầu.
- Payload thật: 1.516 dòng, 930 mã có giá khớp, 1.516 mã có giá tham chiếu; mã thiếu giá khớp giữ null. Endpoint đo cục bộ 257 ms. Worker mới đã làm mới quote thành công, lịch sử tiếp tục chạy.
- Kiểm tra: Ruff, mypy domain, 63 backend test (coverage 87,91%), frontend lint (1 warning cũ), 12 test và build qua; kiểm tra trực quan bảng giá, tìm VCB và cột dữ liệu.
- Tối ưu lô lịch sử: không gọi lại 3 chỉ số khi VN-Index đã có, chỉ checkpoint sau khi lô xong; chạy lại 63 backend test và Ruff/mypy đều qua.
- Worker giới hạn refresh quote mỗi 5 phút trong phiên, ngoài phiên một lần/ngày và sau đóng cửa; test lịch giao dịch qua. Trang tự lấy snapshot mới mỗi 5 phút khi đang mở và khi quay lại tab, không che bảng đang xem.
- Sau triển khai Compose, API qua frontend trả 1.516 mã, 930 mã có giá khớp, 1.516 mã có giá tham chiếu trong 232 ms; trang `/market` HTTP 200. Lô lịch sử tiếp theo nhập thêm 16.451 nến/50 mã, 0 lỗi. Full backend suite trong container sau lần build cuối: 63 test qua, coverage 87,91%; migration head qua.

## BE-VN-QUOTE-FIELDS — kiểm tra trường khối lượng
- [Tài liệu Vnstock 5](https://www.vnstocks.com/docs/vnstock/thi-truong-market) mục 2.3 và 8.1: `Market().quote(symbols)` có 23 cột giá, bid/ask và khối lượng giao dịch của khối ngoại; không có tổng khối lượng hoặc tổng giá trị giao dịch. Không suy ra `volume`/`tradingValue` từ bid/ask hay khối ngoại vì sai ý nghĩa.
- Không đổi code. Thử kiểm payload trực tiếp bị chặn vì Docker Desktop hiện không chạy (`dockerDesktopLinuxEngine` không tồn tại); cần xác nhận lại schema runtime khi Docker chạy. Bảng giá giữ trống các cột không có dữ liệu.
- Khảo sát thêm: `Insights().sentiment.heatmap()` là nguồn bulk cho vốn hoá/khối lượng/giá trị theo sàn, nhưng yêu cầu Bronze; Community nhận `EntitlementError`. `Market().equity(s).summary()` chưa được hỗ trợ ở Vnstock 5. Ghi spec/giới hạn vào `docs/decisions.md`, không gọi 1.516 endpoint từng mã và không sửa code khi chưa có nguồn phù hợp.

## BE-VN-NEXT — trang mã và tổng quan nhanh hơn
- Thêm `/api/v1/market/board/{symbol}` từ snapshot đã lưu; tổng quan dùng cùng snapshot cho số tăng/giảm, mã dẫn đầu và ngành. Không gán khối lượng giao dịch khi KBS không có trường đó.
- Khi snapshot KBS vắng mặt, bảng giữ 1.516 mã và dùng close VCI của phiên mới nhất đã lưu, gắn `stale`/`vci-eod`; mã chỉ có nến cũ để trống, không suy đoán giá tham chiếu. Cache fallback 60 giây.
- Trang mã lấy riêng một quote; dashboard cho tin tải độc lập, bỏ request thừa và polling 10 giây. Bản đồ nhiệt dùng top 200 khối lượng EOD và màu theo biên độ thường từng sàn, bỏ nhãn trần/sàn suy đoán.
- Sau khi Docker mở lại, worker báo thiết bị Vnstock bị vô hiệu hoá; cần chủ tài khoản gỡ thiết bị Docker cũ để worker lấy snapshot KBS mới. Dữ liệu VCI đã lưu vẫn dùng được.
- Compose cuối: `/market`, `/dashboard`, `/stock/FPT` HTTP 200; bảng có 1.516 mã, 296 mã có nến đúng phiên 06/11, `stale`/`vci-eod`; lượt cache 232 ms. Kiểm tra trực quan cả ba trang. Ruff, mypy, migration và 66 backend test qua (coverage 87,91%); frontend lint, 13 test và build qua.

## BE-VN-RECOVER — khôi phục worker sau gỡ thiết bị
- Chủ tài khoản đã gỡ thiết bị Vnstock cũ; restart worker đăng ký danh mục thành công. Phát hiện image worker còn bản cũ, chưa có `_run_quote_board`; build lại riêng worker, giữ `.env` và volume `vnstock_auth`.
- Worker mới nhập snapshot KBS: 1.516/1.516 mã trả về, 930 có giá khớp, 1.516 có giá tham chiếu; `/api/v1/market/board` báo `current`, FPT 50.800/TC 52.900. Job lịch sử mới ở trạng thái `running`.
- Không đổi key, không reset volume hay database. Ghi cách build đủ worker trong `backend/VNSTOCK_SETUP.md`.

## BE-09 — request ID an toàn
- Chỉ nhận request ID tối đa 128 ký tự chữ, số, `.`, `_`, `-`; giá trị khác được thay UUID trước khi ghi log/phản hồi. Cập nhật mục P2 trong `docs/security-review.md`.
- Kiểm tra: 2 test mới, Ruff toàn backend và mypy domain qua. Docker Engine không cho truy cập nên chưa chạy test tích hợp/migration trong Compose.

## BE-VN-HISTORY — checkpoint từng mã thành công
- Job lưu tên mã lấy lịch sử lỗi và chỉ checkpoint các mã đã xử lý; mã lỗi được thử lại, các mã thành công không cần gọi lại cả lô. Số `remaining` còn tính cả mã lỗi.
- Kiểm tra: 3 test `test_sync_universe.py` qua; Ruff và mypy qua. Chưa xác minh tiến độ 1.516 mã trên database vì Docker Engine từ chối truy cập. Full pytest không có kết quả khi thiếu PostgreSQL, đã dừng sau 50 giây.

## OPS-01 — chuẩn bị vận hành
- Viết `docs/production-operations.md` và liên kết từ README: quyền dữ liệu, cấu hình, backup/restore, health, giám sát và xử lý sự cố. Chưa triển khai công khai.
- Kiểm tra: `docker compose config --quiet`, `git diff --check` qua. Chưa có tên miền và xác nhận quyền công bố nguồn giá thật.

## FE-QA — rà mã nguồn và kiểm tra frontend
- Rà các trang chính và mobile bằng mã nguồn; không thấy P0/P1. TopNav còn một lượt polling `/market/status` mỗi phút có thể trùng với trang, mức P2.
- Kiểm tra: `npm run lint`, `npm test` (13 test), `npm run build` qua. Chưa chụp ảnh trình duyệt vì môi trường hiện không cho truy cập Docker/localhost.

## BE-VN-VERIFY — xác minh giá thật cục bộ
- Truy cập Docker bằng quyền phù hợp: backend, frontend, PostgreSQL, Redis và worker đều chạy; API báo `source=vnstock`, bảng KBS có 1.516 mã, 930 mã có giá khớp. Lịch sử VCI có 869 mã, 555 mã tới ngày VN-Index 06/11; backfill chưa hoàn tất.
- `alembic upgrade head` và full backend pytest qua: 69 test, domain coverage 87,91%. Worker cũ đã nhập thêm nhiều lô; một lô lỗi nguồn VCI và job kế tiếp đã chạy. Build lại riêng worker để áp dụng sửa checkpoint, giữ database và volume thiết bị; log xác nhận đồng bộ danh mục 1.516 mã.
- Cấu hình Render vẫn là `csv-demo`; quyền hiển thị công khai dữ liệu KBS/VCI chưa được xác nhận. Bản local dùng giá thật, không phải CSV demo.

## RENDER-VERIFY — kiểm tra trước khi commit/deploy
- Đổi đường AI của API sang async route/service; web đọc bars và quote đã lưu qua `AsyncSession`, không gọi provider trực tiếp và không dùng `asyncio.run` trong request production. Thêm test cho dữ liệu database và kiểm tra worker yêu cầu key/package.
- Build image production với `INSTALL_VNSTOCK=true` thành công; `.dockerignore` loại `.env`, dependency và build output. `docker compose config --quiet` qua.
- Kiểm tra: Ruff, mypy, 73 backend test với coverage domain 87,91%, frontend lint, 13 test, build đều qua. Docker Compose smoke test: `/ready`, API data-status, `/`, `/market` đều HTTP 200; worker đồng bộ 1.516 mã.
- API local báo `source=vnstock`, `dataMode=market-provider`, trạng thái `stale`; coverage tại lần kiểm tra là 1.121 mã có lịch sử và 715 mã tới ngày chỉ số. Chưa deploy Render hoặc push branch.

## FREE-DAILY-SYNC — hướng miễn phí
- Thêm `backend/scripts/daily_sync.py`: mỗi lần chạy đồng bộ danh mục, bảng giá, RSS, một lô lịch sử 50 mã và event study rồi thoát; không cần worker chạy liên tục hoặc persistent disk.
- Thêm workflow GitHub Actions chạy 16:30 giờ Việt Nam ngày làm việc; secrets chỉ nằm trong GitHub Actions. Thêm `render-free.yaml` cho web Render Free dùng PostgreSQL ngoài (Supabase/Neon).
- Giới hạn được ghi rõ: web có thể sleep, workflow có thể trễ, lịch sử backfill theo lô 50 mã/ngày; dữ liệu hiển thị `asOf`/`stale`, không gọi là realtime.
- Cache định danh Vnstock được thêm vào workflow để hạn chế đăng ký thiết bị mới mỗi lần GitHub Actions tạo runner.
