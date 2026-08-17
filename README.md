# FinSight — Vietnam Stock Market Intelligence Platform

FinSight là nền tảng phân tích thị trường chứng khoán Việt Nam theo phong cách terminal tài chính. Theo dõi chỉ số thời gian thực, tra cứu cổ phiếu với biểu đồ nến, đọc tin tức được AI phân tích tác động, và đặt câu hỏi trực tiếp với trợ lý AI về thị trường.

> **Tuyên bố miễn trừ trách nhiệm**: FinSight chỉ cung cấp thông tin phân tích và giải thích dữ liệu. Ứng dụng **không** đưa ra bất kỳ khuyến nghị mua hoặc bán chứng khoán nào.

---

## Tính năng

| Trang | Nội dung |
|---|---|
| **Dashboard** | 4 chỉ số (VNINDEX/VN30/HNX30/UPCOM), top gainers/losers, AI market commentary, news, breadth |
| **Market Screener** | ~60 cổ phiếu với lọc theo sàn/ngành/biến động/mã, sort, live update |
| **Stock Detail** | Biểu đồ nến + volume (TradingView lightweight-charts), 52W range, AI phân tích riêng từng mã |
| **News Intelligence** | Tin tức RSS được AI phân loại tác động, lọc theo nguồn/impact, sidebar ticker mentions |
| **AI Explain Panel** | Click bất kỳ đối tượng nào (cổ phiếu, chỉ số, tin tức, ngành) để AI giải thích chi tiết TA + FA |
| **AI Chat** | Chatbot floating context-aware, biết đang xem trang nào |

---

## Tech Stack

**Frontend**
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 với `@theme` CSS variables
- `lightweight-charts` v5 (TradingView) — biểu đồ nến OHLCV
- Recharts — area chart

**Backend**
- FastAPI + Python 3.10+
- `vnstock` 4.0.4 — dữ liệu thị trường Việt Nam (KBS/VCI)
- OpenRouter AI (`deepseek/deepseek-chat-v3.1`) — commentary và explain
- TTL-based in-memory caching (commentary 10 min, history 15 min, news 10 min)

**Infrastructure**
- Docker + Docker Compose (one-command start)
- Render (backend) + Vercel (frontend) cho free cloud deploy

---

## Chạy bằng Docker (Khuyên dùng)

```bash
# 1. Clone repo
git clone https://github.com/your-username/finsight.git
cd finsight

# 2. Tạo file .env từ template
cp .env.example .env
# Điền OPENROUTER_API_KEY vào .env (tùy chọn — app chạy được không có key, dùng fallback)

# 3. Start
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

---

## Chạy local 1-click trên Windows

1. Bấm đúp `start-finsight.bat` ở thư mục gốc.
2. Chờ 2 cửa sổ backend/frontend mở lên.
3. Vào:
   - Frontend: http://127.0.0.1:3000
   - Backend: http://127.0.0.1:8000

Muốn tắt nhanh:
- Bấm đúp `stop-finsight.bat`

Lưu ý:
- Backend cần có `backend\venv` sẵn.
- Frontend cần đã cài dependencies (`npm install`) ít nhất một lần.

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
uvicorn main:app --reload --port 8000
```

> Nếu gặp lỗi vnstock, xem `backend/VNSTOCK_SETUP.md` để troubleshoot.

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
| `BACKEND_API_URL` | URL backend (dùng khi deploy frontend lên Vercel) | Không (mặc định `http://127.0.0.1:8000`) |

---

## Deploy miễn phí lên Cloud

### Backend → Render

1. Tạo tài khoản [render.com](https://render.com), chọn **New Web Service**
2. Kết nối GitHub repo
3. Cấu hình:
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables**: thêm `OPENROUTER_API_KEY`
5. Deploy → nhận URL backend (vd: `https://finsight-backend.onrender.com`)

### Frontend → Vercel

1. Tạo tài khoản [vercel.com](https://vercel.com), import GitHub repo
2. Cấu hình:
   - **Root Directory**: `frontend`
   - **Framework**: Next.js
3. **Environment Variables**: thêm `BACKEND_API_URL` = URL Render từ bước trên
4. Deploy → hoàn tất

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

- Giá cổ phiếu: `vnstock` → Trading KBS (realtime quote), VCI (OHLCV history)
- Chỉ số: `vnstock` Market API
- Tin tức: RSS feeds (VnExpress, VnEconomy)
- AI: OpenRouter — `deepseek/deepseek-chat-v3.1`

Khi backend offline hoặc vnstock không phản hồi, app tự động dùng seed data để không bị trắng trang.
