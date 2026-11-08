from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import chat as ai_chat_service, explain as ai_explain_service
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
def explain_market(request: ExplainRequest):
    return ai_explain_service(request.model_dump())


@router.post("/ai/chat")
def chat_market(request: ChatRequest):
    context = {
        "type": request.context_type,
        "title": request.context_title,
        "data": request.context_data,
    }
    return {"response": ai_chat_service(request.question, context=context)}
