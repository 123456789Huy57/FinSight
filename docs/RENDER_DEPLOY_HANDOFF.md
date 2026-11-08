# FinSight — bàn giao để đưa website dữ liệu thật lên Render

Cập nhật: 08/11/2026. Mục tiêu cuối cùng là **website công khai trên Render dùng dữ liệu giá thật**, không phải bản CSV minh hoạ. Theo yêu cầu mới nhất của chủ dự án, công việc triển khai đã dừng ở trạng thái mô tả dưới đây; chưa push hoặc deploy.

## 1. Hiện trạng đã xác minh

- Bản local chạy bằng Docker: frontend Next.js, API FastAPI, worker, PostgreSQL và Redis đều hoạt động. PostgreSQL lưu dữ liệu lâu dài; worker lấy dữ liệu từ Vnstock và ghi vào đó; web đọc dữ liệu đã lưu.
- API local báo `source=vnstock`, `dataMode=market-provider`. Bảng giá KBS có danh mục **1.516 mã** HOSE/HNX/UPCOM; tại lần kiểm tra, **930 mã có giá khớp** và 1.516 mã có giá tham chiếu. Đây là snapshot có thể trễ, không phải luồng realtime của sở giao dịch.
- Lịch sử VCI đã có ở **869/1.516 mã**; **555 mã** có nến tới ngày VN-Index gần nhất (06/11/2026) tại lần kiểm tra. Worker còn tải tiếp theo lô và hạn mức tài khoản; chưa thể tuyên bố hai năm lịch sử đã hoàn tất.
- T+1/T+5 dùng giá điều chỉnh và VN-Index, chỉ hiện số khi đủ phiên và không trùng sự kiện. Lần kiểm tra worker ghi **0 kết quả `measured` trên 235 sự kiện**; không được thay bằng số tự tạo.
- Đã sửa checkpoint backfill: mã lấy lịch sử lỗi được thử lại riêng, mã thành công không tải lại cả lô. Đã cập nhật worker local mà không xoá database, volume thiết bị hoặc nhập lại key.
- Trước đợt chuẩn bị Render chưa hoàn tất này, backend qua **69 test**, coverage `domain` **87,91%**, Ruff, mypy và migration. Frontend qua lint, **13 test** và build. Các thay đổi Render chưa được chạy lại toàn bộ bộ kiểm tra.

## 2. Quyền dữ liệu và phạm vi sản phẩm

- Chủ dự án xác nhận **đã hỏi nhà cung cấp và được phép dùng dữ liệu cho website công khai**. Ghi nhận này dựa trên lời xác nhận của chủ dự án; repo chưa lưu nội dung trả lời hoặc phạm vi cụ thể. Chủ dự án tự giữ bằng chứng/điều khoản đã nhận để đối chiếu khi cần; **không gửi API key trong chat hoặc commit vào Git**.
- Key Vnstock cấp quyền truy cập thư viện; bản thân key không mô tả quyền của nguồn KBS/VCI. Nếu phạm vi sử dụng thay đổi (ví dụ bán dữ liệu, cung cấp API cho bên thứ ba), cần đối chiếu lại với bên cấp quyền. [Tài liệu Vnstock](https://vnstocks.com/docs) và [nguồn dữ liệu](https://www.vnstocks.com/docs/vnstock/tham-khao/data-sources).
- Vnstock Community hiện **không cung cấp đầy đủ** khối lượng/giá trị giao dịch toàn thị trường, vốn hoá, P/E/P/B qua các endpoint bulk đã kiểm chứng. Web để trống hoặc ghi rõ ngày/nguồn của trường thiếu; không suy đoán từ bid/ask hay khối ngoại. Đủ 1.516 mã không đồng nghĩa đủ mọi chỉ số như FireAnt.

## 3. Kiến trúc Render dự kiến

| Thành phần | Chức năng | Cấu hình dự kiến |
| --- | --- | --- |
| Web service `finsight` | Một URL chạy Next.js và FastAPI; API đọc PostgreSQL | `MARKET_PROVIDER=vnstock`; **không có** `VNSTOCK_API_KEY`; `RUN_SNAPSHOT_JOBS=false` |
| Worker `finsight-worker` | Một tiến trình lấy danh mục, quote KBS, lịch sử VCI, tin tức và event study | Cài Vnstock; `MARKET_PROVIDER=vnstock`; key chỉ ở biến môi trường worker |
| PostgreSQL `finsight-db` | Lưu bars, snapshot, tài khoản và tiến độ job | Database managed; web và worker dùng chung |
| Key Value `finsight-cache` | Redis cho cache/giới hạn tần suất | Được khai báo trong Blueprint |
| Persistent disk worker | Giữ định danh **một thiết bị** Vnstock qua restart/deploy | Gắn riêng worker tại `/data/vnstock`; không chia sẻ với web |

Render cho phép gắn persistent disk với **worker trả phí**; disk chỉ thuộc một service instance và không dùng được trong bước build. Vì Community giới hạn một thiết bị, không chạy đồng thời nhiều worker dùng cùng tài khoản. [Tài liệu Render về persistent disk](https://render.com/docs/disks) và [Blueprint YAML](https://render.com/docs/blueprint-spec).

**Không có nhánh tự chuyển về CSV** khi Vnstock lỗi. Web phải hiển thị dữ liệu cũ với nhãn `stale`, hoặc `no_data`/lỗi cùng thời điểm và nguồn. Render không cần máy tính cá nhân của chủ dự án bật liên tục sau khi đã triển khai.

## 4. Việc đã sửa trong repo

Các commit gần nhất trên branch `backend/phase-4`: `3baba27` (retry backfill), `f81cc0e` (request ID), `ceedacd` (hướng dẫn vận hành), `9280f3f` (xác minh local và full backend test). Chưa push branch này lên GitHub.

**Đang sửa nhưng chưa commit, chưa xác minh deploy:** `render.yaml` chuyển web/worker sang `vnstock`, thêm key dạng secret và disk cho worker; `Dockerfile` thêm cách cài gói Vnstock cho image worker; `.dockerignore` loại build output và `.env` ở mọi thư mục; `backend/worker.py` kiểm tra key/package lúc khởi động; dịch vụ AI chuyển hướng đọc dữ liệu đã lưu thay vì để web gọi Vnstock. README, tài liệu Vnstock, quyết định và runbook đã được cập nhật theo hướng deploy thật. Có hai file test mới cho worker và AI.

**Cảnh báo trạng thái:** Lệnh build image Render đã bị dừng trước khi có kết quả. Bản AI đang dùng `asyncio.run` để đọc database trong route đồng bộ; cần rà lại vòng lặp/connection pool và test với PostgreSQL trước khi dùng production. Các file chưa commit **không nên coi là đã sẵn sàng để bấm Deploy**.

## 5. Codex cần làm khi chủ dự án cho tiếp tục

1. Hoàn tất đường đọc database của AI để web không gọi Vnstock và không có rủi ro `asyncio.run` với connection pool. Kiểm tra mọi request API dùng nguồn `vnstock` nhưng **chỉ worker** giữ key và gọi nhà cung cấp.
2. Build thành công Docker image Render với `INSTALL_VNSTOCK=true`; xác nhận `.dockerignore` không đưa `.env`, `node_modules` hay `.venv` vào build context. Kiểm tra cấu hình Blueprint và disk đúng cú pháp Render.
3. Chạy lại Ruff, mypy, migration, full backend pytest với PostgreSQL, frontend lint/test/build; kiểm tra API source/status/quote và worker sau restart. Ghi kết quả vào `docs/backend-log.md`.
4. Review diff, loại bỏ phần sai hoặc thừa, tạo commit nhỏ. **Không push hoặc provision dịch vụ cho tới khi chủ dự án yêu cầu tiếp tục** (yêu cầu hiện tại là dừng triển khai và viết file này).
5. Sau khi được phép deploy: kiểm tra runtime trên Render, tiến độ backfill, alert lỗi/stale, backup/restore và giao diện desktop/mobile qua URL thật. Không quảng cáo là realtime nếu chỉ có snapshot trễ.

## 6. Chủ dự án cần chuẩn bị

- **Đã xong:** xác nhận với nhà cung cấp rằng dự án được dùng dữ liệu công khai. Giữ lại nội dung trả lời và phạm vi quyền để dùng khi đối chiếu; không cần gửi key cho Codex.
- **Khi sẵn sàng trả phí/deploy:** có tài khoản Render, kết nối repo GitHub và xem chi phí dự kiến trước khi tạo Blueprint. Worker có persistent disk và compute trả phí; PostgreSQL, web và Redis/Key Value cũng cần chọn plan phù hợp. Chưa chốt số tiền vì giá/plan phụ thuộc tài khoản và thời điểm tạo.
- Đặt `VNSTOCK_API_KEY` **chỉ trong môi trường worker Render** qua Dashboard/Blueprint prompt. Đặt `CORS_ORIGINS` bằng đúng URL HTTPS của web Render hoặc domain riêng; các biến database/Redis/JWT được Blueprint nối/tạo theo cấu hình.
- Community chỉ cho một thiết bị. Trước **lần đăng nhập đầu của worker Render**, có thể cần gỡ thiết bị Docker/Linux cũ tại tài khoản Vnstock để nhường chỗ. Sau đó giữ disk Render và không chạy đồng thời worker local bằng cùng key. Việc này không đồng nghĩa phải nhập lại key ở mỗi lần deploy.
- Có thể dùng URL `*.onrender.com` trước; nếu muốn tên miền riêng, cần sở hữu domain và trỏ DNS theo hướng dẫn Render. Tên miền riêng không phải điều kiện để thử endpoint công khai.

## 7. Trình tự lên mạng và tiêu chí hoàn tất

1. Codex hoàn tất và kiểm chứng mã ở mục 5, sau đó branch được push lên GitHub theo yêu cầu của chủ dự án.
2. Tạo Render Blueprint từ branch đã kiểm chứng; xem trước các service, disk, database và chi phí **trước khi xác nhận tạo**. Nhập key vào worker và CORS origin; không đặt key ở frontend/web.
3. Đợi migration và worker khởi động. Kiểm `/ready`, `/api/v1/market/data-status`, `/api/v1/market/board`, `/market`, `/stock/FPT`, login và tin tức. API phải báo `source=vnstock`, `dataMode=market-provider`; bảng giá phải ghi thời điểm snapshot và trạng thái stale khi nguồn chậm/lỗi.
4. Theo dõi worker và quota khi database Render mới backfill. Danh mục có thể đủ 1.516 mã trước khi mọi mã có lịch sử hai năm; không tuyên bố backfill xong dựa riêng vào số mã niêm yết.
5. Thiết lập backup/restore, giám sát lỗi và dữ liệu cũ, kiểm tra sau restart/redeploy rằng định danh thiết bị còn trên disk. Gắn domain riêng và HTTPS nếu cần.

**Hoàn tất** khi web công khai chạy bằng dữ liệu Vnstock thật, key không lộ, worker ổn định qua redeploy, backup được kiểm tra, và các trường thiếu được thể hiện trung thực. Hiện trạng **chưa đạt**: chưa push, chưa tạo dịch vụ Render, chưa build/test xong các thay đổi Render và backfill local vẫn đang tiếp tục.
