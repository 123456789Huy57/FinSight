# FinSight VnStock Setup

## Môi trường hiện tại

- Python: 3.12
- Virtual environment: `backend/venv`
- Vnstock: `4.0.4`

## Cách kích hoạt môi trường

```powershell
.\backend\venv\Scripts\Activate.ps1
```

## Kiểm tra nhanh

```powershell
python -c "import vnstock; print(vnstock.__version__)"
python -m pip show vnstock
```

## Diagnostics

Chạy script kiểm tra môi trường khi cần:

```powershell
$env:PYTHONUTF8='1'
py C:\Users\Huynguyen\Desktop\FinSight\vnstock-vibe-coding-main\vnstock-vibe-coding-main\.agents\skills\vnstock-vibe-onboarding\scripts\diagnostics.py
```

## Ghi chú kỹ thuật

- Backend FinSight đã có sẵn `vnstock 4.0.4` trong `backend/venv`
- Không cần cài lại nếu bạn chỉ đang tiếp tục phát triển project hiện tại
- Khi thêm nguồn dữ liệu mới, ưu tiên đặt logic ở `backend/services/` thay vì viết trực tiếp trong `main.py`
- Có thể cấu hình nguồn tin tài chính bằng biến môi trường `FINSIGHT_NEWS_FEEDS`
- Ví dụ:

```powershell
$env:FINSIGHT_NEWS_FEEDS="https://vnexpress.net/rss/kinh-doanh.rss,https://vneconomy.vn/rss.htm"
```
