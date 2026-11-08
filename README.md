# FinSight — Vietnam Stock Market Intelligence Platform

FinSight là ứng dụng phân tích thị trường chứng khoán Việt Nam. Dữ liệu thị trường được lấy theo nguồn cấu hình, lưu vào PostgreSQL và phục vụ qua API v1. Dự án không cam kết dữ liệu realtime.

> **Tuyên bố miễn trừ trách nhiệm**: FinSight chỉ cung cấp thông tin phân tích và giải thích dữ liệu. Ứng dụng **không** đưa ra bất kỳ khuyến nghị mua hoặc bán chứng khoán nào.

---

## Tính năng

| Trang | Nội dung |
|---|---|
| **Dashboard** | Chỉ số, biến động, độ rộng và tin tức nếu provider đã đồng bộ dữ liệu |
| **Market Screener** | Danh sách mã từ symbol directory trong database, lọc theo sàn/ngành/biến động |
| **Stock Detail** | Biểu đồ nến + volume (TradingView lightweight-charts), 52W range, AI phân tích riêng từng mã |
| **News Intelligence** | Tin RSS, liên kết mã và sentiment baseline theo từ khóa tiếng Việt; không gọi heuristic là AI |
| **AI Explain Panel** | Click bất kỳ đối tượng nào (cổ phiếu, chỉ số, tin tức, ngành) để AI giải thích chi tiết TA + FA |
| **AI Chat** | Chatbot floating context-aware, biết đang xem trang nào |
| **Tài khoản API** | Email/password, JWT access token và refresh cookie; watchlist/portfolio cá nhân qua `/api/v1` |
| **Backtest API** | Buy-and-hold, DCA, SMA crossover, RSI mean reversion; lệnh khớp phiên kế tiếp, phí/thuế và lô 100 |

---

## Tech Stack

**Frontend**
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 với `@theme` CSS variables
- `lightweight-charts` v5 (TradingView) — biểu đồ nến OHLCV
- Recharts — area chart

**Backend**
- FastAPI + Python 3.10+
- Adapter provider; CSV synthetic dùng cho demo local, Vnstock là nguồn giá thật được chủ dự án dự định dùng cho bản Render công khai theo xác nhận của chủ dự án về trao đổi với nhà cung cấp
- SQLAlchemy async + Alembic + PostgreSQL; Redis tùy chọn cho cache/rate-limit
- OpenRouter AI (`deepseek/deepseek-chat-v3.1`) — commentary và explain
- TTL-based in-memory caching (commentary 10 min, history 15 min, news 10 min)

**Infrastructure**
- Docker + Docker Compose (one-command start)
- Render Blueprint: một URL web cho Next.js + FastAPI; Postgres, Key Value và worker là tài nguyên backing

---

## Chạy bằng Docker (Khuyên dùng)

```bash
# 1. Clone repo
git clone https://github.com/your-username/finsight.git
cd finsight

# 2. Tạo file .env từ template
cp .env.example .env
# Mặc định MARKET_PROVIDER=csv để chạy demo synthetic; AI key là tùy chọn
# RSS VnExpress/VnEconomy được bật theo xác nhận quyền lưu/hiển thị; mỗi tin giữ attribution

# 3. Start frontend, API, worker, PostgreSQL và Redis
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs (Compose): http://localhost:8000/docs
- Readiness (Compose): http://localhost:8000/ready
- API v1 qua frontend: http://localhost:3000/api/v1/market/overview

Để chạy dữ liệu Vnstock Community cục bộ, đặt `MARKET_PROVIDER=vnstock`, `INSTALL_VNSTOCK=true`, `VNSTOCK_API_KEY` và `VNSTOCK_SYMBOLS=ALL` trong `.env`. Worker nhập danh mục HOSE/HNX/UPCOM, lấy bảng giá nhiều mã trong một request (mỗi 5 phút trong phiên), rồi tải lịch sử hai năm theo lô riêng. Bảng giá ở http://localhost:8000/api/v1/market/board; tiến độ lịch sử ở http://localhost:8000/api/v1/market/data-status. Bản Render mục tiêu dùng Vnstock cho dữ liệu thật; chỉ worker giữ API key và định danh thiết bị trên persistent disk riêng. Xem [hướng dẫn Vnstock](backend/VNSTOCK_SETUP.md), [kiến trúc dữ liệu thị trường](docs/market-data-architecture.md) và [vận hành production](docs/production-operations.md).

---

## Chạy local 1-click trên Windows

Khuyến nghị dùng Docker Compose để có PostgreSQL/Redis, chạy migration và seed lịch sử synthetic tự động. Các script `.bat` cũ chỉ dành cho môi trường local đã cài dependency riêng.

---

## Chạy thủ công

### Backend

```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
# When running from backend/, copy the root template here so Settings loads it:
cp ../.env.example .env
alembic upgrade head
uvicorn main:app --reload --port 8000
```

Để có dữ liệu ban đầu và RSS, chạy worker ở terminal thứ hai:

```bash
cd backend
python worker.py
```

> Worker được khởi chạy trực tiếp bằng `python worker.py` (không phải ASGI app). Nếu cần thử provider vnstock cục bộ và có quyền truy cập phù hợp, cài thêm `requirements-vnstock.txt`; xem `backend/VNSTOCK_SETUP.md`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Truy cập http://localhost:3000.

---

## Biến môi trường

| Biến | Mô tả | Bắt buộc |
|---|---|---|
| `OPENROUTER_API_KEY` | API key từ [openrouter.ai](https://openrouter.ai) | Không (app dùng fallback nếu thiếu) |
| `BACKEND_API_URL` | Backend upstream cho Next.js proxy; unified Docker mặc định dùng localhost nội bộ | Không |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL async | Không khi chạy bằng Compose |
| `REDIS_URL` | Redis URL; readiness kiểm tra nếu được cấu hình | Không |
| `MARKET_PROVIDER` | `csv` (mặc định cho demo local) hoặc `vnstock` (provider thật; xem `backend/VNSTOCK_SETUP.md`) | Không |
| `NEWS_FEED_ENABLED` | `true` bật RSS VnExpress/VnEconomy cho API và worker; tắt bằng `false` | Không |
| `JWT_SECRET` | Secret ký access token; production phải dùng chuỗi ngẫu nhiên riêng | Có ở production |
| `VNSTOCK_API_KEY` | Key Community; chỉ đặt trong môi trường backend worker, không đặt ở frontend hay public web service | Tùy chọn |
| `INSTALL_VNSTOCK` | Đặt `true` để cài gói Vnstock vào image Docker cục bộ | Không |
| `VNSTOCK_SYMBOLS` | `ALL` lấy danh mục HOSE/HNX/UPCOM; có thể dùng danh sách mã để giới hạn | Không |
| `VNSTOCK_REQUEST_DELAY_SECONDS` | Khoảng nghỉ giữa các lần lấy lịch sử cổ phiếu (mặc định 6 giây) | Không |

---

## Deploy một URL trên Render

`render.yaml` khai báo web service, worker, PostgreSQL và Key Value. Hướng triển khai hiện tại dùng Vnstock cho dữ liệu giá thật theo xác nhận của chủ dự án rằng họ đã hỏi nhà cung cấp và có thể dùng dữ liệu công khai. Đây là attestation của chủ dự án; README không khẳng định có văn bản cấp quyền hay mở rộng phạm vi điều khoản. Worker là tiến trình duy nhất kết nối Vnstock, dùng một persistent disk trả phí để giữ device identity; web đọc bars/snapshots đã lưu trong PostgreSQL. Không scale worker thành nhiều instance hoặc để web gọi thẳng provider. Nếu provider lỗi, hiển thị stale/lỗi/no-data, tuyệt đối không âm thầm chuyển sang CSV. Xem checklist deploy và kiểm tra tại [production operations](docs/production-operations.md). Có thể cấu hình `OPENROUTER_API_KEY` nếu muốn AI upstream. Render services/database/disk có thể phát sinh phí tùy plan; kiểm tra chi phí trong dashboard trước khi provision.

Trước khi provision môi trường công khai, xem [production operations readiness](docs/production-operations.md) về secret hygiene, backup/restore và monitoring.

### Deploy miễn phí, cập nhật một lần mỗi ngày

Dùng [render.yaml](render.yaml) cho web, PostgreSQL Free của Supabase
hoặc Neon, và workflow [daily-market-sync.yml](.github/workflows/daily-market-sync.yml)
để cập nhật dữ liệu vào khoảng 16:30 giờ Việt Nam từ thứ Hai đến thứ Sáu.
Tạo GitHub Actions secrets `MARKET_DATABASE_URL`, `MARKET_JWT_SECRET` và
`VNSTOCK_API_KEY`; không đặt key Vnstock trên web Render. Gói miễn phí có thể
ngủ, workflow có thể chạy trễ, và mỗi lần chỉ tải một lô lịch sử 50 mã.
Website hiển thị `asOf`/`stale`; đây là dữ liệu cuối ngày, không phải realtime.
Xem [hướng dẫn triển khai miễn phí](docs/FREE_DAILY_DEPLOYMENT.md) để tạo
database, secrets và chạy lần đồng bộ đầu tiên.

---

## Cấu trúc dự án

```
finsight/
├── .env.example
├── docker-compose.yml
├── run-finsight.ps1        # Windows local dev launcher
│
├── backend/
│   ├── main.py             # FastAPI routes
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── diagnostics.py      # Kiểm tra kết nối vnstock
│   ├── VNSTOCK_SETUP.md    # Troubleshoot vnstock
│   └── services/
│       ├── stock_service.py  # Market data, caching, screener
│       ├── news_service.py   # RSS feed + caching
│       └── ai_service.py     # OpenRouter integration
│
└── frontend/
    ├── app/
    │   ├── dashboard/        # Market overview
    │   ├── market/           # Stock screener
    │   ├── stock/[symbol]/   # Stock detail + chart
    │   ├── news/             # News intelligence
    │   └── api/              # Next.js API proxy routes
    ├── components/
    │   ├── ai/               # ExplainPanel, ChatWidget
    │   ├── dashboard/        # IndexCard, MoversPanel, etc.
    │   ├── layout/           # TopNav, MarketTicker
    │   ├── news/             # NewsCard
    │   ├── shared/           # Skeleton, ExplainButton
    │   └── stock/            # CandlestickChart
    └── lib/
        └── api.ts            # Typed API client
```

---

## Dữ liệu

- Giá cổ phiếu: Vnstock v5 là provider giá thật cho triển khai mục tiêu; CSV synthetic dành cho demo local. Chủ dự án xác nhận đã hỏi nhà cung cấp và được phép dùng dữ liệu công khai; phạm vi trả lời/điều khoản không được mô tả thêm ở đây.
- Danh mục mã/ngành: Vnstock v5 cho triển khai thật; CSV synthetic dành cho demo local.
- Tin tức: RSS VnExpress/VnEconomy, bật cho Render và Docker Compose sau khi chủ dự án xác nhận quyền lưu/hiển thị; bài giữ tên nhà xuất bản và liên kết nguồn. Kiểm tra lại điều khoản trước khi đổi mục đích phân phối.
- AI: OpenRouter — `deepseek/deepseek-chat-v3.1`; market commentary dashboard hiển thị rule-based snapshot, không gắn nhãn là AI
- Local Compose mặc định dùng dữ liệu **synthetic demo** tạo bởi `backend/scripts/generate_demo_data.py`, có `data_mode=synthetic-demo` và `source=csv-demo`; không phải giá lịch sử thật. Render mục tiêu dùng `vnstock` và các hàng dữ liệu thật đã lưu trong PostgreSQL.
- Khi provider thật lỗi, app không thay bằng giá demo tĩnh; nguồn/giá không có phải hiển thị lỗi hoặc `null`.
- v1 JSON camelCase, prefix `/api/v1`; các route cũ còn lại cho tương thích trong lúc chuyển frontend.
