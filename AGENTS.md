# FinSight

FinSight đặt tin tài chính Việt Nam cạnh biến động giá cổ phiếu. T+1/T+5 là số đo quan sát so với VN-Index, không phải khuyến nghị đầu tư.

Trước khi sửa backend, đọc `docs/BACKEND_PLAN.md` mục 0–4 và task liên quan. Vnstock Community hiện là lựa chọn thử nghiệm cục bộ; xem `backend/VNSTOCK_SETUP.md` và `docs/decisions.md`.

Trước khi sửa frontend, đọc `docs/REDESIGN_PLAN.md` mục 2 và `frontend/AGENTS.md`.

Kiểm tra backend trong `backend/`: `ruff check .`, `mypy domain --ignore-missing-imports`, `alembic upgrade head`, `pytest tests -q --cov=domain --cov-fail-under=80`. Cần PostgreSQL từ Compose cho test tích hợp.

Kiểm tra frontend trong `frontend/`: `npm run lint`, `npm test`, `npm run build`.

Giữ khóa nhà cung cấp ở môi trường backend/worker; không commit `.env`. Không âm thầm dùng CSV khi provider thật lỗi. Sau mỗi task ghi kết quả ngắn vào `docs/backend-log.md`.
