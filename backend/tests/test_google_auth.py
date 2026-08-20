"""Google Sign-In audience verification tests (Phase 8.4).

tokeninfo already verifies signature/issuer/expiration server-side at Google; the
audience (aud) claim must still be checked by us, since a validly-signed token for a
different OAuth client would otherwise be accepted.
"""
import os
import sys
import uuid

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

import core
import routers.auth as auth_router
import server

client = TestClient(server.app)


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeAsyncClient:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self._status_code = status_code

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, *a, **kw):
        return _FakeResponse(self._status_code, self._payload)


def _google_payload(**overrides):
    payload = {
        "email": f"user_{uuid.uuid4().hex[:6]}@example.com",
        "email_verified": "true",
        "name": "Test User",
        "aud": "expected-client-id.apps.googleusercontent.com",
    }
    payload.update(overrides)
    return payload


def test_wrong_audience_rejected_when_client_id_configured(monkeypatch):
    monkeypatch.setattr(core, "GOOGLE_CLIENT_ID", "expected-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router, "GOOGLE_CLIENT_ID", "expected-client-id.apps.googleusercontent.com")
    payload = _google_payload(aud="some-other-app.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(payload))

    r = client.post("/api/auth/google", json={"credential": "fake-id-token"})
    assert r.status_code == 401
    assert "audience" in r.json()["detail"].lower() or "not issued" in r.json()["detail"].lower()


def test_matching_audience_accepted_when_client_id_configured(monkeypatch):
    monkeypatch.setattr(core, "GOOGLE_CLIENT_ID", "expected-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router, "GOOGLE_CLIENT_ID", "expected-client-id.apps.googleusercontent.com")
    payload = _google_payload(aud="expected-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(payload))

    r = client.post("/api/auth/google", json={"credential": "fake-id-token"})
    assert r.status_code == 200
    assert r.json()["email"] == payload["email"]


def test_missing_audience_rejected_when_client_id_configured(monkeypatch):
    monkeypatch.setattr(core, "GOOGLE_CLIENT_ID", "expected-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router, "GOOGLE_CLIENT_ID", "expected-client-id.apps.googleusercontent.com")
    payload = _google_payload()
    del payload["aud"]
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(payload))

    r = client.post("/api/auth/google", json={"credential": "fake-id-token"})
    assert r.status_code == 401


def test_audience_not_checked_when_client_id_unconfigured(monkeypatch):
    # Matches pre-existing behavior when GOOGLE_CLIENT_ID is never set (e.g. local dev).
    monkeypatch.setattr(core, "GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr(auth_router, "GOOGLE_CLIENT_ID", None)
    payload = _google_payload(aud="anything-at-all")
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(payload))

    r = client.post("/api/auth/google", json={"credential": "fake-id-token"})
    assert r.status_code == 200


def test_unverified_email_still_rejected(monkeypatch):
    monkeypatch.setattr(core, "GOOGLE_CLIENT_ID", None)
    monkeypatch.setattr(auth_router, "GOOGLE_CLIENT_ID", None)
    payload = _google_payload(email_verified="false")
    monkeypatch.setattr(auth_router.httpx, "AsyncClient", lambda *a, **kw: _FakeAsyncClient(payload))

    r = client.post("/api/auth/google", json={"credential": "fake-id-token"})
    assert r.status_code == 401
