"""Minimal in-memory rate limiting (Phase 8.1).

No new dependency: a per-process sliding-window counter keyed by client IP + route.
Fine for a single-instance deployment; document as a known limitation if this ever
runs behind multiple worker processes (each process has its own counters).
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

import core

_BUCKETS: dict[str, deque] = defaultdict(deque)


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, max_requests: int, window_seconds: float = 60.0):
    """FastAPI dependency factory: `dependencies=[Depends(rate_limit("analyze", 10, 60))]`.

    Skipped when ENVIRONMENT=test so the (large, shared-client) automated test suite
    doesn't trip its own limits; see tests/test_rate_limit.py for direct coverage of
    the limiting logic itself.
    """
    async def _dep(request: Request):
        if core.ENVIRONMENT == "test":
            return
        key = f"{name}:{_client_key(request)}"
        now = time.monotonic()
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down and try again shortly.")
        bucket.append(now)
    return _dep
