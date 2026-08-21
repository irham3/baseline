"""Rate limiting (Phase 8.1) and CSRF/origin protection (Phase 8.3) tests.

Rate limiting is skipped app-wide when ENVIRONMENT=test (see rate_limit.py) so the
rest of the suite doesn't trip its own limits; the limiting logic itself is tested
directly here by calling the dependency with ENVIRONMENT temporarily flipped.
"""
import os
import sys

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import core
import rate_limit
import server

client = TestClient(server.app)


class _FakeClient:
    host = "203.0.113.5"


class _FakeRequest:
    def __init__(self, host="203.0.113.5", fwd=None):
        self.client = _FakeClient()
        self.client.host = host
        self.headers = {"x-forwarded-for": fwd} if fwd else {}


def test_rate_limit_blocks_after_max_requests(monkeypatch):
    monkeypatch.setattr(core, "ENVIRONMENT", "development")
    dep = rate_limit.rate_limit("unit-test-bucket", max_requests=3, window_seconds=60)
    req = _FakeRequest()
    for _ in range(3):
        asyncio.run(dep(req))  # should not raise
    with pytest.raises(HTTPException) as exc:
        asyncio.run(dep(req))
    assert exc.value.status_code == 429


def test_rate_limit_keys_are_per_client(monkeypatch):
    monkeypatch.setattr(core, "ENVIRONMENT", "development")
    dep = rate_limit.rate_limit("unit-test-bucket-2", max_requests=1, window_seconds=60)
    asyncio.run(dep(_FakeRequest(host="203.0.113.10")))
    # A different client isn't blocked by the first client's usage.
    asyncio.run(dep(_FakeRequest(host="203.0.113.11")))


def test_rate_limit_bypassed_in_test_environment():
    # core.ENVIRONMENT is "test" for the whole suite (see module-level setdefault
    # above) -- hitting a rate-limited endpoint many times in a row must not 429.
    for _ in range(15):
        r = client.get("/api/health")
        assert r.status_code == 200


# -------- CSRF / origin guard --------
def test_state_changing_request_with_cookie_and_foreign_origin_blocked():
    r = client.post(
        "/api/auth/logout",
        headers={"Origin": "https://evil.example.com"},
        cookies={"access_token": "whatever"},
    )
    assert r.status_code == 403


def test_state_changing_request_with_cookie_and_allowed_origin_ok():
    r = client.post(
        "/api/auth/logout",
        headers={"Origin": "http://localhost:3000"},
        cookies={"access_token": "whatever"},
    )
    assert r.status_code == 200  # logout succeeds regardless of token validity


def test_guest_request_without_cookie_not_blocked_by_csrf_guard():
    # No cookie-based auth token present -> guard doesn't apply (guest flows use a
    # custom header, which a cross-site page cannot forge from another origin).
    r = client.post("/api/analytics", json={"event": "estimate_viewed", "props": {}},
                    headers={"Origin": "https://evil.example.com"})
    assert r.status_code == 200
