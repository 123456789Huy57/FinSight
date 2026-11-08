# BE-07 — Rà soát bảo mật trước deploy

Ngày rà soát: 07/11/2026. Phạm vi: xác thực, cấu hình, CORS, proxy API, watchlist, portfolio và backtest. Đây là rà soát mã nguồn; chưa chạy kiểm thử xâm nhập. **P0: không phát hiện.** BE-08 xử lý các mục P1 dưới đây.

## P1 — cần sửa trước khi deploy

1. **Giới hạn đăng nhập đang dùng chung một IP của proxy.** `backend/api/v1/auth.py:44-45`, `:99-100`, `:117-118`; `frontend/app/api/v1/[...path]/route.ts:8-10`. Backend nhận request từ Next proxy nên nhiều người dùng có cùng `request.client.host`. Tám request đăng nhập hoặc đăng ký trong một phút có thể khóa cả nhóm người dùng; đồng thời không giới hạn riêng số lần thử đối với một tài khoản. BE-08: dùng khóa theo email đã chuẩn hóa/băm cho login, cộng giới hạn IP rộng hơn; xác định IP thật chỉ qua proxy được tin cậy, tuyệt đối không tin trực tiếp header do client gửi. Test nhiều email qua cùng proxy và nhiều lần thử một email.
2. **Redis lỗi thì giới hạn đăng nhập chuyển sang bộ nhớ từng tiến trình.** `backend/api/v1/auth.py:49-66`. Khi Redis gặp lỗi, mỗi replica/restart đếm lại từ đầu và việc từ chối có thể không nhất quán. BE-08: ở production khi đã cấu hình Redis, lỗi Redis phải từ chối tạm thời các endpoint xác thực (503), hoặc dùng một kho đếm tập trung dự phòng; chỉ dùng fallback trong development/test. Test nhánh Redis lỗi.
3. **Request body không có giới hạn dung lượng.** `frontend/app/api/v1/[...path]/route.ts:16`; `backend/main.py:90-98`. Proxy đọc toàn bộ body bằng `request.text()`; backend cũng không giới hạn body trước khi parse JSON. Một request lớn có thể tiêu tốn bộ nhớ ở cả hai dịch vụ. BE-08: đặt trần nhỏ phù hợp payload JSON, kiểm tra `Content-Length` và đếm byte khi đọc stream để chặn cả request truyền chunk; trả 413. Test qua proxy và trực tiếp backend.
4. **Production vẫn chấp nhận JWT secret quá yếu.** `backend/core/config.py:32-39`. Validator hiện chỉ chặn giá trị rỗng hoặc secret mặc định; giá trị tùy chỉnh ngắn như `x` vẫn được nhận. BE-08: yêu cầu secret production có độ dài/entropy tối thiểu (ví dụ tối thiểu 32 byte ngẫu nhiên), kiểm tra bằng test. `render.yaml:26-27` hiện dùng `generateValue: true` nên cấu hình Render mặc định không mắc lỗi này.

## P2 — cải thiện sau BE-08

1. **Refresh chưa có giới hạn tần suất.** `backend/api/v1/auth.py:138-147`. Request thiếu/sai cookie vẫn làm việc lặp lại ở endpoint này; thêm giới hạn theo client ở `/refresh` và `/logout` để giảm tải, đồng thời theo dõi 401/429.
2. **Đăng ký tiết lộ email đã tồn tại.** `backend/api/v1/auth.py:102-112`. Trả 409 khác với email mới, cho phép dò tài khoản; cân nhắc phản hồi đồng nhất nếu sản phẩm không cần báo trùng email trực tiếp.
3. **Request ID do client tự đặt được ghi và phản hồi nguyên trạng.** `backend/main.py:91-97`. Đã xử lý: chỉ nhận chuỗi tối đa 128 ký tự gồm chữ, số, `.`, `_`, `-`; giá trị khác được thay bằng UUID trước khi ghi log và phản hồi.

## Các kiểm tra đã đạt

- `backend/api/v1/account.py:33`, `:49`, `:64-70`, `:75-84`, `:91-123`: watchlist và portfolio truy vấn/khóa bằng `user.id`; không thấy truy cập dữ liệu của người khác qua ID do client chọn.
- `backend/api/v1/backtests.py:50-51`, `:66`, `:76`: kết quả được gắn `user_id`; list/detail đều lọc theo chủ sở hữu; ID của người khác trả 404.
- `backend/api/v1/auth.py:70-74`, `:166-184`: JWT có hạn 15 phút, kiểm tra chữ ký, loại token và trạng thái user. Refresh token ngẫu nhiên, chỉ lưu SHA-256 và xoay vòng dưới khóa hàng (`:89-94`, `:134-150`).
- `backend/api/v1/auth.py:77-85`: refresh cookie có `HttpOnly`, `SameSite=Lax`, `Secure` ở production và giới hạn `Path`. Có thể thêm kiểm tra Origin cho các POST dùng cookie nếu sau này chạy nhiều subdomain cùng site.
- `backend/main.py:56-63`, `backend/core/config.py:44-48`: CORS dùng danh sách origin cấu hình, không cho credential cross-origin. Logger request chỉ ghi phương thức, path và status (`backend/main.py:91-98`), không ghi Authorization/Cookie hay query string. Cần tiếp tục tránh đưa secret vào chuỗi exception ở các job.

## BE-08 — kết quả xử lý P1

- Auth dùng khóa HMAC của email đã chuẩn hóa (8 lần/phút) và giới hạn IP rộng hơn (120 lần/phút), không tin header IP từ client. Production trả 503 khi Redis lỗi thay vì đếm cục bộ.
- Proxy Next và backend cùng chặn body JSON quá 1 MiB; backend kiểm tra cả luồng không có `Content-Length`, trả 413.
- Production yêu cầu JWT secret tối thiểu 32 byte và có ít nhất 8 ký tự khác nhau. Test bao phủ secret mặc định, secret yếu, auth Redis lỗi và body chia nhiều chunk.
- Các mục P1 trên đã sửa; P2 vẫn mở.
