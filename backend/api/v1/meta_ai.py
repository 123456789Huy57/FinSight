import inspect
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import chat_async as ai_chat_service, explain_async as ai_explain_service
from services.stock_service import get_data_sources, get_market_status


router = APIRouter(prefix="/api/v1", tags=["v1 meta and ai"])


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


@router.get("/meta")
def data_sources():
    return get_data_sources()


@router.get("/market/status")
def market_status():
    return get_market_status()


@router.post("/ai/explain")
async def explain_market(request: ExplainRequest):
    result = ai_explain_service(request.model_dump())
    return await result if inspect.isawaitable(result) else result


@router.post("/ai/chat")
async def chat_market(request: ChatRequest):
    context = {
        "type": request.context_type,
        "title": request.context_title,
        "data": request.context_data,
    }
    result = ai_chat_service(request.question, context=context)
    return {"response": await result if inspect.isawaitable(result) else result}
