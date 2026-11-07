import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from core.config import settings
from db.health import readiness
from api.v1.stocks import router as stocks_v1_router
from api.v1.market import router as market_v1_router
from api.v1.news import router as news_v1_router
from api.v1.auth import router as auth_v1_router
from api.v1.account import router as account_v1_router
from api.v1.backtests import router as backtests_v1_router
from services.ai_service import chat as ai_chat_service, explain as ai_explain_service
from services.stock_service import (
    get_indices as get_indices_service,
    get_market_status as get_market_status_service,
    get_market_breadth as get_market_breadth_service,
    get_market_commentary as get_market_commentary_service,
    get_quote as get_quote_service,
    get_data_sources as get_data_sources_service,
    get_stock_ohlcv,
    get_search_results,
    get_most_active as get_most_active_service,
    get_news_intelligence as get_news_intelligence_service,
    get_sector_performance as get_sector_performance_service,
    get_top_movers as get_top_movers_service,
    get_screener_data as get_screener_data_service,
    get_stock_profile as get_stock_profile_service,
    refresh_market_snapshot,
)


async def _snapshot_loop():
    """Warm the in-process cache so user requests do not pay the batch cost."""
    while True:
        try:
            await asyncio.to_thread(refresh_market_snapshot)
        except Exception as exc:
            print(f"snapshot refresh failed: {exc}", flush=True)
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = (
        asyncio.create_task(_snapshot_loop())
        if settings.environment != "test" and settings.run_snapshot_jobs
        else None
    )
    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(lifespan=lifespan)
app.include_router(stocks_v1_router)
app.include_router(market_v1_router)
app.include_router(news_v1_router)
app.include_router(auth_v1_router)
app.include_router(account_v1_router)
app.include_router(backtests_v1_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("finsight.api")


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now().astimezone().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        for key in ("request_id", "method", "path", "status_code"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload, ensure_ascii=False)


if not logger.handlers:
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(JsonLogFormatter())
    logger.addHandler(stream_handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info("request", extra={"request_id": request_id, "method": request.method,
                                  "path": request.url.path, "status_code": response.status_code})
    return response


@app.exception_handler(HTTPException)
async def api_http_error(request: Request, exc: HTTPException):
    if request.url.path.startswith("/api/v1/"):
        code = {404: "NOT_FOUND", 401: "UNAUTHORIZED", 409: "CONFLICT", 422: "VALIDATION_ERROR"}.get(exc.status_code, "REQUEST_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "The request could not be completed"
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": code, "message": message}})
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def api_validation_error(request: Request, exc: RequestValidationError):
    if request.url.path.startswith("/api/v1/"):
        return JSONResponse(status_code=422, content={"error": {
            "code": "VALIDATION_ERROR", "message": "Request parameters or body are invalid"
        }})
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def api_unexpected_error(request: Request, exc: Exception):
    logger.exception("unhandled request error", extra={"request_id": getattr(request.state, "request_id", None),
                                                       "method": request.method, "path": request.url.path})
    if request.url.path.startswith("/api/v1/"):
        return JSONResponse(status_code=500, content={"error": {
            "code": "INTERNAL_ERROR", "message": "The request could not be completed"
        }})
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})



class ExplainRequest(BaseModel):
    type: str
    title: str | None = None
    symbol: str | None = None
    sector: str | None = None
    context: str | None = None
    snapshot: dict | None = None


class ChatRequest(BaseModel):
    question: str
    context_type: str | None = None
    context_title: str | None = None
    context_data: Any | None = None


@app.get("/")
def root():
    return {"message": "FinSight AI Backend Running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    checks = await readiness()
    return JSONResponse(checks, status_code=200 if checks["status"] == "ok" else 503)


@app.get("/meta/data-sources")
def get_data_sources():
    return get_data_sources_service()


@app.get("/stock/{symbol}/profile")
def get_stock_profile_endpoint(symbol: str):
    return get_stock_profile_service(symbol)


@app.get("/stock/{symbol}/history")
def get_stock_history_endpoint(symbol: str, days: int = 180):
    result = get_stock_ohlcv(symbol, days=days)
    if "error" in result and not result.get("candles"):
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/search")
def search_market(q: str = ""):
    return get_search_results(q)


@app.get("/quote/{symbol}")
def get_quote(symbol: str):
    result = get_quote_service(symbol)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/indices")
def get_market_indices():
    result = get_indices_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/status")
def get_market_status():
    return get_market_status_service()


@app.get("/market/top-movers")
def get_market_top_movers():
    result = get_top_movers_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/breadth")
def get_market_breadth():
    result = get_market_breadth_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/most-active")
def get_market_most_active():
    result = get_most_active_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/sectors")
def get_market_sectors():
    result = get_sector_performance_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/screener")
def get_market_screener():
    result = get_screener_data_service()
    if "error" in result and not result.get("stocks"):
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/market/commentary")
def get_market_commentary():
    result = get_market_commentary_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.get("/news/intelligence")
def get_news_intelligence():
    if not settings.news_feed_enabled:
        return {"updated_at": None, "items": [], "source": None, "data_mode": None, "status": "disabled"}
    result = get_news_intelligence_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@app.post("/ai/explain")
def explain_market(request: ExplainRequest):
    return ai_explain_service(request.model_dump())


@app.post("/ai/chat")
def chat_market(request: ChatRequest):
    context = {
        "type": request.context_type,
        "title": request.context_title,
        "data": request.context_data,
    }
    return {"response": ai_chat_service(request.question, context=context)}
