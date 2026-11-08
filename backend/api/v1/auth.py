import hashlib
import hmac
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from core.config import settings
from db.models import RefreshToken, User
from db.session import AsyncSessionLocal

router = APIRouter(prefix="/api/v1/auth", tags=["v1 auth"])
password_hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
_attempts: dict[str, list[float]] = {}
_attempt_lock = threading.Lock()
ACCESS_MINUTES = 15
REFRESH_DAYS = 30
COOKIE_NAME = "finsight_refresh"
COOKIE_PATH = "/api/v1/auth"


class Credentials(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=10, max_length=128)


def _clean_email(email: str) -> str:
    value = email.strip().lower()
    if value.count("@") != 1 or "." not in value.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    return value


async def _rate_limit(request: Request, action: str, email: str) -> None:
    # The Next proxy shares one backend IP among users. Bound each account
    # separately and keep a wider IP cap for bulk attempts.
    digest = hmac.new(settings.jwt_secret.encode(), email.encode(), hashlib.sha256).hexdigest()
    client_ip = request.client.host if request.client else "unknown"
    buckets = ((f"auth-rate:{action}:email:{digest}", 8),
               (f"auth-rate:{action}:ip:{client_ip}", 120))
    try:
        from redis.asyncio import Redis

        if settings.redis_url:
            client = Redis.from_url(settings.redis_url, socket_connect_timeout=1)
            try:
                for bucket, limit in buckets:
                    count = await client.incr(bucket)
                    if count == 1:
                        await client.expire(bucket, 60)
                    if count > limit:
                        raise HTTPException(status_code=429, detail="Too many attempts; retry in a minute")
            finally:
                await client.aclose()
            return
    except HTTPException:
        raise
    except Exception:
        if settings.environment.lower() == "production" and settings.redis_url:
            raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable") from None
    now = time.monotonic()
    with _attempt_lock:
        for bucket, limit in buckets:
            recent = [stamp for stamp in _attempts.get(bucket, []) if now - stamp < 60]
            if len(recent) >= limit:
                raise HTTPException(status_code=429, detail="Too many attempts; retry in a minute")
            _attempts[bucket] = [*recent, now]


def _access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user.id, "email": user.email, "type": "access",
                       "iat": now, "exp": now + timedelta(minutes=ACCESS_MINUTES)},
                      settings.jwt_secret, algorithm="HS256")


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(COOKIE_NAME, token, httponly=True,
                        secure=settings.environment.lower() == "production",
                        samesite="lax", path=COOKIE_PATH, max_age=REFRESH_DAYS * 86400)


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH, httponly=True,
                           secure=settings.environment.lower() == "production", samesite="lax")


async def _create_session(user: User, response: Response, session) -> dict:
    raw_refresh = secrets.token_urlsafe(48)
    session.add(RefreshToken(id=str(uuid.uuid4()), user_id=user.id,
                             token_hash=hashlib.sha256(raw_refresh.encode()).hexdigest(),
                             expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS)))
    _set_refresh_cookie(response, raw_refresh)
    return {"accessToken": _access_token(user), "tokenType": "Bearer", "expiresIn": ACCESS_MINUTES * 60,
            "user": {"id": user.id, "email": user.email}}


@router.post("/register", status_code=201)
async def register(payload: Credentials, request: Request, response: Response):
    email = _clean_email(payload.email)
    await _rate_limit(request, "register", email)
    try:
        async with AsyncSessionLocal.begin() as session:
            if await session.scalar(select(User.id).where(User.email == email)):
                raise HTTPException(status_code=409, detail="An account with this email already exists")
            user = User(id=str(uuid.uuid4()), email=email, password_hash=password_hasher.hash(payload.password))
            session.add(user)
            await session.flush()
            result = await _create_session(user, response, session)
    except IntegrityError:
        # The unique database constraint also handles concurrent registrations.
        raise HTTPException(status_code=409, detail="An account with this email already exists") from None
    return result


@router.post("/login")
async def login(payload: Credentials, request: Request, response: Response):
    email = _clean_email(payload.email)
    await _rate_limit(request, "login", email)
    async with AsyncSessionLocal.begin() as session:
        user = await session.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
        valid = False
        if user:
            try:
                valid = password_hasher.verify(user.password_hash, payload.password)
            except VerifyMismatchError:
                valid = False
        if not user or not valid:
            raise HTTPException(status_code=401, detail="Email or password is incorrect")
        return await _create_session(user, response, session)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        raise HTTPException(status_code=401, detail="Refresh session is missing")
    digest = hashlib.sha256(raw.encode()).hexdigest()
    async with AsyncSessionLocal.begin() as session:
        record = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == digest).with_for_update())
        now = datetime.now(timezone.utc)
        if not record or record.revoked_at or record.expires_at <= now:
            _clear_refresh_cookie(response)
            raise HTTPException(status_code=401, detail="Refresh session is invalid or expired")
        user = await session.get(User, record.user_id)
        if not user or not user.is_active:
            _clear_refresh_cookie(response)
            raise HTTPException(status_code=401, detail="Account is unavailable")
        record.revoked_at = now
        return await _create_session(user, response, session)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    raw = request.cookies.get(COOKIE_NAME)
    if raw:
        digest = hashlib.sha256(raw.encode()).hexdigest()
        async with AsyncSessionLocal.begin() as session:
            record = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == digest))
            if record and not record.revoked_at:
                record.revoked_at = datetime.now(timezone.utc)
    _clear_refresh_cookie(response)
    return response


async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Bearer access token is required")
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
        if claims.get("type") != "access":
            raise ValueError("wrong token type")
        user_id = claims["sub"]
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Access token is invalid or expired") from None
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    return user


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return {"id": user.id, "email": user.email}
