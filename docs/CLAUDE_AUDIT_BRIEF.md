# Brief kiểm tra FinSight trước khi tiếp tục phát triển

## Mục đích

Hãy kiểm tra độc lập FinSight như một reviewer dữ liệu tài chính và kỹ sư backend.
Mục tiêu là tìm lỗi khiến ứng dụng hiển thị sai quan hệ:

```text
tin tức → mã cổ phiếu → ngành → biến số kinh tế → hướng tác động
```

Không chỉ kiểm tra giao diện hoặc việc code có chạy. Phải kiểm tra xem kết luận
có hợp lý, có căn cứ và có thể giải thích minh bạch hay không.

## Bối cảnh lỗi đã quan sát

Trang tin từng hiển thị:

```text
Tin: Vụ bê bối của CEO Jensen Huang đặt tương lai Nvidia vào thế khó
Mã liên quan: CEO, LAI, TRA
Ngành: Bất động sản, Xây dựng, Dược phẩm
```

Đây là kết quả sai. Tin nói về Nvidia và ngành chip/công nghệ toàn cầu, nhưng
không có căn cứ để gắn với ba mã Việt Nam trên.

Các lỗi nghi ngờ:

1. Chữ thường trong nội dung, ví dụ `lai`, bị nhận nhầm thành ticker `LAI`.
2. Tên ngành hoặc vài từ cuối tên công ty bị dùng như bằng chứng liên kết.
3. Liên kết sai cũ trong database vẫn được hiển thị sau khi logic đã sửa.
4. `category`, `sentiment` và vài từ khóa đang bị dùng để tạo ra dự báo quá chung.
5. Confidence hiện là heuristic, chưa được backtest nhưng có thể khiến người dùng
   hiểu nhầm là xác suất dự báo.

## Phạm vi bắt buộc

### 1. Kiểm tra liên kết tin với mã

Đọc và kiểm tra:

- `backend/jobs/ingest_news.py`
- `backend/api/v1/news.py`
- `backend/db/models.py`
- `backend/jobs/compute_event_studies.py`
- `backend/tests/test_news_service.py`

Trả lời rõ:

- Một mã được liên kết khi nào?
- Có trường hợp nào khớp chữ thường, substring, từ viết tắt hoặc tên ngành không?
- Có thể liên kết nhầm do mã trùng từ tiếng Việt không?
- Khi RSS cập nhật bài, liên kết cũ và event study cũ có được xoá đúng không?
- API có đang trả dữ liệu cũ từ cache hoặc bảng khác không?

Tạo test hồi quy cho tối thiểu các trường hợp:

```text
CEO trong tiêu đề không được tạo mã CEO.
“tương lai” không được tạo mã LAI.
“xây dựng”, “dược phẩm”, “bất động sản” không được tự tạo mã.
Tin Nvidia không được liên kết CEO, LAI, TRA nếu không nhắc tên/mã doanh nghiệp Việt Nam.
Tin “Hòa Phát công bố kết quả kinh doanh” được liên kết HPG nếu tên doanh nghiệp
được nhận diện rõ.
Ticker viết hoa độc lập, có ranh giới từ, được nhận diện đúng.
```

### 2. Kiểm tra dữ liệu production và migration

Không đọc hoặc in secret/API key.

Kiểm tra bằng truy vấn an toàn:

- Các `news_articles` mới nhất.
- `news_symbols` của các bài đó.
- Tên và ngành của các mã được liên kết.
- Các liên kết có mã là từ chức danh, từ tiếng Việt hoặc mã không xuất hiện
  trong tiêu đề/tóm tắt hay không.
- Có event study tồn tại cho liên kết sai hay không.

Nếu có quyền truy cập database, xuất danh sách nghi vấn gồm:

```text
article_id, headline, symbol, company_name, sector, reason
```

Không xoá dữ liệu production nếu chưa có xác nhận. Nếu cần cleanup, đề xuất
migration hoặc command idempotent trước, nêu rõ số bản ghi bị tác động.

### 3. Kiểm tra bản đồ tác động

Đọc logic tạo `possibleImpact`, `impactDetail` và `forecast`.

Đánh giá từng phần:

- `driver` có phải biến số cụ thể không?
- `mechanism` có giải thích đường truyền từ tin đến doanh thu, chi phí, biên lợi
  nhuận, nhu cầu hoặc định giá không?
- Có phân biệt tác động trực tiếp và tác động lan tỏa không?
- Có nêu chiều tác động hay chỉ nói “có thể ảnh hưởng”?
- Có từ chối kết luận khi thiếu mã hoặc thiếu thông tin không?
- Tin quốc tế có bị ép gán vào mã Việt Nam không?

Dùng các ví dụ kiểm tra:

1. Giá điện mặt trời:
   - Biến số nên là giá bán điện đầu ra.
   - Có thể ảnh hưởng doanh thu/biên lợi nhuận nhà phát điện.
   - Không được tự gắn mã nếu bài không nêu doanh nghiệp.
2. Nvidia/Jensen Huang:
   - Biến số là nhu cầu chip, chi tiêu hạ tầng công nghệ hoặc rủi ro quản trị.
   - Không được tự gắn CEO, LAI, TRA.
   - Không được gọi đây là tác động trực tiếp lên cổ phiếu Việt Nam.
3. Lãi suất:
   - Phải phân biệt ngân hàng, doanh nghiệp vay nhiều và nhóm hưởng lợi từ
     chi phí vốn thấp.
   - Không được áp cùng một chiều cho mọi ngành.
4. Tỷ giá:
   - Phải phân biệt doanh nghiệp xuất khẩu và doanh nghiệp nhập khẩu.

### 4. Kiểm tra forecast và confidence

Xác minh:

- Forecast đang dựa trên dữ liệu nào.
- Có dùng giá, xu hướng, RSI, lợi suất, event study hay chỉ dùng sentiment.
- Confidence có được backtest/calibrate không.
- Nếu chưa được kiểm định, UI/API có ghi rõ “mức tin cậy tham khảo” không.
- Không được dùng confidence như xác suất thắng.
- Không được đưa khuyến nghị mua/bán.

Nếu chưa có backtest, đề xuất:

- Đổi nhãn thành `Mức tin cậy tham khảo`.
- Hạ hoặc ẩn confidence khi không có dữ liệu giá đủ.
- Lưu lại lý do và các tín hiệu dùng để tạo forecast.
- Thiết kế bộ đánh giá T+1/T+5 trên các tin đã có dữ liệu.

### 5. Kiểm tra cache và quy trình cập nhật

Kiểm tra:

- RSS ingest có cập nhật lại liên kết của bài cũ không.
- Event study cũ có bị xoá khi liên kết bị xoá không.
- API có cache response cũ không.
- Daily workflow có thực sự chạy ingest news sau khi deploy không.
- Render web và GitHub Actions có dùng cùng database không.
- Cách xác minh sau deploy là gì.

## Nguyên tắc đánh giá

- Ưu tiên đúng dữ liệu hơn việc hiển thị nhiều mã.
- Không chắc thì không liên kết.
- Không bịa mã, ngành, doanh thu hoặc hướng tác động.
- Tin không có mã Việt Nam liên quan phải được hiển thị như tin tham khảo thị
  trường/ngành, không ép thành phân tích cổ phiếu.
- T+1/T+5 là biến động quan sát, không khẳng định quan hệ nhân quả.
- Heuristic không được gọi là mô hình AI hoặc xác suất đã kiểm định.

## Lệnh kiểm tra tối thiểu

Chạy từ thư mục `backend`:

```powershell
python -m pytest tests -q
ruff check .
mypy domain --ignore-missing-imports
```

Chạy từ thư mục `frontend`:

```powershell
npm run lint
npm test
npm run build
```

Nếu thiếu PostgreSQL hoặc Docker, ghi rõ lệnh nào chưa chạy được và lý do.
Không thay thế integration test bằng kết luận “syntax đúng”.

## Định dạng báo cáo bắt buộc

Báo cáo theo thứ tự:

1. **Kết luận ngắn:** hiện tại có thể tin phần liên kết tin–mã đến mức nào?
2. **Các lỗi nghiêm trọng:** sắp xếp theo mức độ và confidence.
3. **Bằng chứng:** file, dòng, test hoặc truy vấn cụ thể.
4. **Các lỗi dữ liệu production:** bài nào, mã nào, vì sao sai.
5. **Điều đã đúng:** tránh chỉ liệt kê lỗi.
6. **Kế hoạch sửa theo thứ tự:** việc nào phải làm trước khi tiếp tục UI.
7. **Tiêu chí nghiệm thu:** test cụ thể và ví dụ đầu vào/đầu ra.
8. **Kết luận deploy:** có nên tiếp tục đưa dữ liệu hiện tại lên public không?

Không trả lời chung chung như “nên cải thiện độ chính xác”. Mỗi nhận định phải
gắn với bằng chứng trong code, dữ liệu hoặc test.
