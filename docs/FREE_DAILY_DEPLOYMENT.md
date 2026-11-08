# FinSight miễn phí, cập nhật mỗi ngày

Mô hình này không chạy worker liên tục:

```text
Render Free web → PostgreSQL Free (Supabase/Neon)
GitHub Actions mỗi ngày → Vnstock → PostgreSQL
```

Web chỉ đọc dữ liệu đã lưu. Workflow chạy lúc 16:30 giờ Việt Nam từ thứ Hai
đến thứ Sáu, đồng bộ bảng giá, tin RSS, một lô lịch sử 50 mã và event study.
Một lần chạy thủ công được thực hiện ở GitHub Actions > Daily market data sync
> Run workflow.

## Chuẩn bị PostgreSQL

1. Tạo project miễn phí trên Supabase hoặc Neon.
2. Lấy chuỗi kết nối PostgreSQL trực tiếp, không dùng chuỗi qua pooler nếu
   provider báo lỗi với asyncpg.
3. Giữ chuỗi này trong GitHub Secret `MARKET_DATABASE_URL`.

## Tạo GitHub Secrets

Trong Settings > Secrets and variables > Actions, thêm:

- `MARKET_DATABASE_URL`: chuỗi PostgreSQL của Supabase/Neon.
- `MARKET_JWT_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 byte.
- `VNSTOCK_API_KEY`: key Vnstock, chỉ workflow sử dụng.

Workflow có cache định danh Vnstock. Không xoá cache đó nếu chưa chủ ý đăng ký
lại thiết bị; GitHub Actions vẫn có thể thay runner hoặc làm cache hết hạn.

## Deploy web

Trong Render chọn New > Blueprint, chọn branch `main`, rồi chọn file
`render-free.yaml`. Khi được hỏi `DATABASE_URL`, nhập cùng database URL nhưng
chỉ ở biến môi trường Render. Đặt `CORS_ORIGINS` bằng đúng URL `onrender.com`.

Blueprint này không tạo worker, Redis hay persistent disk trả phí. Web Free có
thể ngủ khi không có truy cập; lần mở đầu có thể chậm.

## Giới hạn cần nói rõ

- Dữ liệu là giá thật từ provider theo quyền đã xác nhận, nhưng cập nhật theo
  lịch workflow, không phải realtime.
- Workflow có thể chạy trễ hoặc thất bại; UI phải giữ `asOf` và `stale`.
- Lịch sử đầy đủ 1.516 mã cần nhiều ngày vì mỗi ngày chỉ xử lý một lô 50 mã.
- GitHub Actions và gói database miễn phí có hạn mức, có thể cần chạy thủ công
  hoặc chuyển sang gói trả phí khi dự án tăng.
