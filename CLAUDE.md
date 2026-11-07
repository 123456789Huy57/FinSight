# FinSight: ngữ cảnh dự án

Nền tảng đọc tin tài chính Việt Nam cạnh phản ứng giá cổ phiếu. Lõi sản phẩm: mỗi bản tin được gắn mã liên quan và đo biến động giá T+1/T+5 so với VN-Index (event study). Không đưa khuyến nghị mua/bán.

## Kế hoạch đang chạy
Đọc `docs/REDESIGN_PLAN.md`: mục 0–3 và đúng task đang làm. Thiết kế và nội dung bắt buộc ở mục 2 (nền sáng, Be Vietnam Pro, token `--fs-*`).

## Stack
- Frontend: Next.js 16 App Router, TypeScript, Tailwind CSS v4, lightweight-charts (biểu đồ nến). Mọi dữ liệu đi qua `frontend/lib/api.ts`.
- Backend: FastAPI, SQLAlchemy async, Alembic, PostgreSQL 16, Redis, worker APScheduler. API ở `/api/v1`.
- Nguồn giá hiện tại: CSV tổng hợp (`MARKET_PROVIDER=csv`, dataMode `synthetic-demo`). Chưa có nguồn giá thật.
- Tin: RSS (VnExpress Kinh doanh, VnEconomy chứng khoán); sentiment là từ điển từ khoá, không phải mô hình AI.

## Chạy local
```powershell
Copy-Item .env.example .env
docker compose up --build -d
```
Frontend http://localhost:3000, API docs http://localhost:8000/docs.

## Quy tắc làm việc
- Không bịa dữ liệu. Thiếu trường thì để null và hiện "Chưa có dữ liệu".
- Không ghi "thời gian thực", "realtime", "AI" khi thực tế không phải vậy. Nhãn dữ liệu lấy từ `dataMode` và `asOf`.
- Không có khuyến nghị đầu tư. T+1/T+5 là biến động quan sát, không khẳng định nhân quả.
- Mỗi task một phiên, một commit. Hỏi trước khi đổi phạm vi hoặc xoá dữ liệu.
- Phê bình thẳng nếu ý tưởng thiết kế hay dữ liệu yếu.

## File quan trọng
- `docs/PROJECT_HANDOFF.md`: hiện trạng chi tiết.
- `backend/domain/event_study.py`: cách đo T+1/T+5.
- `backend/providers/`: adapter nguồn giá.
- `frontend/lib/api.ts`: client API và mapping.
