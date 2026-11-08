import asyncio
import json
import logging
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from core.config import settings
from core.body_limit import BodySizeLimitMiddleware
from db.health import readiness
from api.v1.stocks import router as stocks_v1_router
from api.v1.market import router as market_v1_router
from api.v1.news import router as news_v1_router
from api.v1.auth import router as auth_v1_router
from api.v1.account import router as account_v1_router
from api.v1.backtests import router as backtests_v1_router
from api.v1.meta_ai import router as meta_ai_v1_router
from services.stock_service import refresh_market_snapshot


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
app.include_router(meta_ai_v1_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(BodySizeLimitMiddleware)

logger = logging.getLogger("finsight.api")
REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")


def safe_request_id(supplied_id: str | None) -> str:
    return supplied_id if supplied_id and REQUEST_ID_PATTERN.fullmatch(supplied_id) else str(uuid.uuid4())


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
    request_id = safe_request_id(request.headers.get("x-request-id"))
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



@app.get("/")
def root():
    return {"message": "FinSight Backend Running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    checks = await readiness()
    return JSONResponse(checks, status_code=200 if checks["status"] == "ok" else 503)
