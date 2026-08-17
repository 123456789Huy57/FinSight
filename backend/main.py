import asyncio
from contextlib import asynccontextmanager
from typing import Any
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    task = asyncio.create_task(_snapshot_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



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
