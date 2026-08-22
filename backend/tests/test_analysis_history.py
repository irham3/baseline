"""Rich analysis history (master plan P1): GET /api/analyses lists an owner's
past briefs, newest first, filterable by readiness_state/profession, and never
leaks another owner's data."""
import os
import sys
import uuid

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

import server

client = TestClient(server.app)


def _guest_headers():
    return {"X-Guest-Id": f"guest_test_{uuid.uuid4().hex[:10]}"}


def _analyze(brief, headers):
    r = client.post("/api/analyze", json={"brief": brief, "use_ai": False}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_lists_newest_first_with_snippet_not_full_brief():
    headers = _guest_headers()
    _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)
    second = _analyze("Butuh 8 video TikTok buat toko baju, deadline 10 hari, budget 4 juta.", headers)

    r = client.get("/api/analyses", headers=headers)
    assert r.status_code == 200, r.text
    items = r.json()["analyses"]
    assert len(items) == 2
    assert items[0]["analysis_id"] == second["analysis_id"]
    assert "brief_snippet" in items[0]
    assert "brief" not in items[0]


def test_filters_by_profession():
    headers = _guest_headers()
    _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)
    _analyze(
        "Bikin website toko online, ada login dan dashboard admin, "
        "butuh programmer buat develop dari nol. Budget 6 juta, deadline satu bulan.",
        headers,
    )

    r = client.get("/api/analyses", headers=headers, params={"profession": "general"})
    assert r.status_code == 200, r.text
    items = r.json()["analyses"]
    assert len(items) == 1
    assert items[0]["profession"] == "general"


def test_does_not_leak_another_owners_analyses():
    headers_a = _guest_headers()
    headers_b = _guest_headers()
    _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers_a)

    r = client.get("/api/analyses", headers=headers_b)
    assert r.status_code == 200, r.text
    assert r.json()["analyses"] == []
