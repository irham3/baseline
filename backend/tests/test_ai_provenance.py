"""AI provenance and fallback tests (Phase 5 / Phase 9): callers must always be able
to tell whether scope evidence came from the seeded demo, live AI, or the deterministic
heuristic fallback, and a broken/malformed LLM response must never crash extraction."""
import os
import sys
import uuid

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import pytest
from fastapi.testclient import TestClient

import ai_service
import server

client = TestClient(server.app)


def _guest_headers():
    return {"X-Guest-Id": f"guest_test_{uuid.uuid4().hex[:10]}"}


def test_seed_brief_has_seed_provenance():
    r = client.post("/api/analyze", json={
        "brief": "Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
                 "Budget is IDR 3M, ideally finished next week. Revisions until it feels right.",
        "use_ai": False,
    }, headers=_guest_headers())
    assert r.status_code == 200
    assert r.json()["provenance"] == "seed"
    assert r.json()["is_demo"] is True


def test_explicit_no_ai_on_real_brief_uses_heuristic_not_seed():
    r = client.post("/api/analyze", json={
        "brief": "Butuh 8 video TikTok buat toko baju, deadline 10 hari, budget 4 juta.",
        "use_ai": False,
    }, headers=_guest_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["provenance"] == "heuristic_fallback"
    assert body["is_demo"] is False
    # A non-seed brief has no computed estimate/options until /estimate is called.
    assert body["estimate"] is None
    assert body["options"] is None


def test_default_use_ai_without_llm_key_falls_back_to_heuristic():
    r = client.post("/api/analyze", json={
        "brief": "Butuh 8 video TikTok buat toko baju, deadline 10 hari, budget 4 juta.",
    }, headers=_guest_headers())
    assert r.status_code == 200
    # No EMERGENT_LLM_KEY is configured in this test environment, so even the default
    # use_ai=True path must gracefully fall back rather than error.
    assert r.json()["provenance"] == "heuristic_fallback"


def test_heuristic_fields_have_verbatim_quotes_only():
    result = ai_service.extract_scope_heuristic("Butuh 10 reels, budget 5jt, revisi 2x")
    for f in result["fields"]:
        if f["status"] == "stated":
            assert f["source_quote"] is not None
            assert f["source_quote"] in "Butuh 10 reels, budget 5jt, revisi 2x"


def test_malformed_llm_json_falls_back_gracefully(monkeypatch):
    class FakeChat:
        def __init__(self, *a, **kw):
            pass

        def with_model(self, *a, **kw):
            return self

        async def send_message(self, *a, **kw):
            return "not valid json {{{"

    monkeypatch.setattr(ai_service, "LlmChat", FakeChat)
    monkeypatch.setattr(ai_service, "UserMessage", lambda text: text)
    monkeypatch.setattr(ai_service, "EMERGENT_LLM_KEY", "fake-key-for-test")

    result = asyncio.run(ai_service.extract_scope("Butuh 10 reels buat brand, budget 5 juta"))
    assert result["provenance"] == "heuristic_fallback"
    assert result["fields"]


def test_llm_success_path_tagged_as_ai(monkeypatch):
    import json as _json

    class FakeChat:
        def __init__(self, *a, **kw):
            pass

        def with_model(self, *a, **kw):
            return self

        async def send_message(self, *a, **kw):
            return _json.dumps({
                "profession": "short_form_video",
                "fields": [
                    {"name": "quantity", "value": 10, "status": "stated",
                     "source_quote": "10 reels", "confidence": 0.9},
                ],
                "ambiguities": [],
                "clarification_candidates": [],
            })

    monkeypatch.setattr(ai_service, "LlmChat", FakeChat)
    monkeypatch.setattr(ai_service, "UserMessage", lambda text: text)
    monkeypatch.setattr(ai_service, "EMERGENT_LLM_KEY", "fake-key-for-test")

    result = asyncio.run(ai_service.extract_scope("need 10 reels for a brand"))
    assert result["provenance"] == "ai"
