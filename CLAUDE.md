# FinSight — Project Context for Claude Code

## Dự án là gì
Vietnam stock market intelligence platform. Dark terminal-style UI, kiểu Koyfin/Bloomberg.
Path: `C:\Users\Huynguyen\Desktop\FinSight`

## Stack
- **Frontend**: Next.js 16 App Router + TypeScript, Tailwind CSS v4, lightweight-charts v5
- **Backend**: FastAPI + Python, vnstock 4.0.4, OpenRouter AI (deepseek-chat-v3.1)

## Chạy local
```bash
# Backend
cd backend && .\venv\Scripts\activate && uvicorn main:app --reload --port 8000

# Frontend (terminal khác)
cd frontend && npm run dev
```

## Các trang đã xây
- `/dashboard` — market overview, indices, movers, commentary, news, breadth, sectors
- `/market` — screener bảng ~60 cổ phiếu, filter exchange/sector/change
- `/stock/[symbol]` — candlestick chart (lightweight-charts v5), 52W range, AI explain
- `/news` — news intelligence, source/impact filter, sidebar stats

## Quy tắc làm việc (QUAN TRỌNG)
- Không bịa data — nếu field không có trong vnstock thì không show
- Không viết demo text generic trong AI panels — mọi phân tích phải gắn với symbol/sector/news cụ thể
- UI phải dense, boxed, production-grade — không demo-ish
- Làm từng phase nhỏ, verify xong mới tiếp
- Hỏi trước khi đổi scope
- Phê bình nếu design/data idea yếu — không đồng ý kiểu xã giao

## Key files
- `backend/services/stock_service.py` — market data, caching, SECTOR_MAP (Vietnamese)
- `backend/services/news_service.py` — RSS feed, 10-min cache
- `backend/services/ai_service.py` — OpenRouter integration, fallback Vietnamese
- `frontend/lib/api.ts` — typed API client
- `frontend/app/stock/[symbol]/page.tsx` — stock detail page
- `frontend/components/stock/CandlestickChart.tsx` — lightweight-charts v5 (SSR-safe)

## Những việc đã hoàn thành (Phase 1–5 + Hardening)
- Phase 1: Dashboard
- Phase 2: Market screener
- Phase 3: Stock page (CandlestickChart, profile endpoint, 52W range)
- Phase 4: News page (NewsCard, impact filter, sidebar)
- Phase 5: Backend cleanup (caching, SECTOR_MAP Vietnamese, remove random demo)
- Hardening: Vietnamese news classification, AI fallback text Vietnamese, NaN guard

## Việc còn lại (nếu muốn tiếp)
- Full-universe expansion cần background worker (hiện tại ~60 symbols curated)
- Pagination cho screener nếu mở rộng universe
- Thêm PE/EPS/MarketCap nếu vnstock expose được (chưa verify)
