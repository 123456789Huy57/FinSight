import asyncio

from core.body_limit import BodySizeLimitMiddleware


def test_streamed_request_is_rejected_after_crossing_limit():
    called = False

    async def app(scope, receive, send):
        nonlocal called
        called = True

    messages = iter([
        {"type": "http.request", "body": b"1234", "more_body": True},
        {"type": "http.request", "body": b"5678", "more_body": False},
    ])
    sent = []

    async def receive():
        return next(messages)

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "method": "POST", "path": "/api/v1/auth/login", "headers": []}
    asyncio.run(BodySizeLimitMiddleware(app, max_bytes=7)(scope, receive, send))

    assert not called
    assert sent[0]["status"] == 413
    assert b"BODY_TOO_LARGE" in sent[1]["body"]


def test_content_length_is_rejected_before_reading_body():
    async def app(scope, receive, send):
        raise AssertionError("oversized request reached app")

    async def receive():
        raise AssertionError("oversized body was read")

    sent = []

    async def send(message):
        sent.append(message)

    scope = {"type": "http", "method": "POST", "path": "/api/v1/auth/login",
             "headers": [(b"content-length", b"9999999")]}
    asyncio.run(BodySizeLimitMiddleware(app)(scope, receive, send))
    assert sent[0]["status"] == 413
