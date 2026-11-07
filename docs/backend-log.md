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
