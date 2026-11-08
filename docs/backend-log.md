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
