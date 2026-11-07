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
