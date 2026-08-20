"""Agreement Sheet security tests: server-side option lookup, tamper resistance,
ownership, state machine, and no private-cost leakage (Phase 4).

Run: python -m pytest tests/test_agreement_security.py -q
"""
import os
import sys
import json
import uuid

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import server
import core

client = TestClient(server.app)

PRIVATE_KEYS = (
    "cost_per_hour", "labor_cost_low", "labor_cost_high", "break_even_low",
    "break_even_high", "target_margin", "buffer_total", "buffers",
)


def _guest_headers():
    return {"X-Guest-Id": f"guest_test_{uuid.uuid4().hex[:10]}"}


SEED_BRIEF_TEXT = ("Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
                    "Budget is IDR 3M, ideally finished next week. Revisions until it feels right.")


def _create_seed_analysis(headers):
    # Matching the literal seed brief text is what routes to the deterministic demo
    # (options/estimate populated immediately); use_ai is irrelevant to that routing.
    r = client.post("/api/analyze", json={"brief": SEED_BRIEF_TEXT, "use_ai": False}, headers=headers)
    assert r.status_code == 200
    return r.json()


def _backdate_agreement(token: str, seconds_ago: int = 3600):
    """Directly mutate the in-memory store to simulate an expired agreement."""
    from datetime import timedelta
    coll = core._mem_db._collections.get("scope_agreements")
    assert coll is not None
    for doc in coll.docs:
        if doc["token"] == token:
            expired_at = core.now_utc() - timedelta(seconds=seconds_ago)
            doc["expires_at"] = core.iso(expired_at)
            return
    raise AssertionError("agreement not found in memory store")


# -------- Happy path + no private-cost leakage --------
def test_create_agreement_and_no_private_data_leaks():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    real_option_b = next(o for o in analysis["options"] if o["id"] == "B")

    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                    json={"option_id": "B", "project_title": "Test Project"}, headers=headers)
    assert r.status_code == 200
    token = r.json()["token"]

    r2 = client.get(f"/api/agreement/{token}")
    assert r2.status_code == 200
    body = r2.json()
    dumped = json.dumps(body)
    for key in PRIVATE_KEYS:
        assert key not in dumped, f"private field '{key}' leaked into public agreement response"

    assert body["snapshot"]["price"] == real_option_b["price"]
    assert body["formula_version"]
    assert body["snapshot_version"]


# -------- Tamper resistance --------
def test_tampered_price_is_ignored_server_computes_real_price():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    real_option_b = next(o for o in analysis["options"] if o["id"] == "B")

    r = client.post(
        f"/api/analysis/{analysis['analysis_id']}/agreement",
        json={"option_id": "B", "project_title": "Hacked", "price": 1, "option": {"price": 1, "quantity": 999}},
        headers=headers,
    )
    assert r.status_code == 200
    token = r.json()["token"]
    snap = client.get(f"/api/agreement/{token}").json()["snapshot"]
    assert snap["price"] == real_option_b["price"]
    assert snap["price"] != 1


def test_tampered_quantity_is_ignored():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    real_option_b = next(o for o in analysis["options"] if o["id"] == "B")

    r = client.post(
        f"/api/analysis/{analysis['analysis_id']}/agreement",
        json={"option_id": "B", "project_title": "Hacked qty", "quantity": 1},
        headers=headers,
    )
    token = r.json()["token"]
    snap = client.get(f"/api/agreement/{token}").json()["snapshot"]
    assert snap["quantity"] == real_option_b["quantity"]


def test_unknown_option_id_returns_422():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                    json={"option_id": "Z", "project_title": "Bad option"}, headers=headers)
    assert r.status_code == 422


# -------- Ownership --------
def test_other_guest_cannot_create_agreement_from_foreign_analysis():
    owner_headers = _guest_headers()
    analysis = _create_seed_analysis(owner_headers)

    other_headers = _guest_headers()
    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                    json={"option_id": "B", "project_title": "Not mine"}, headers=other_headers)
    assert r.status_code == 403


# -------- State machine --------
def test_approved_agreement_cannot_be_changed_again():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    token = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                        json={"option_id": "B", "project_title": "Approve me"}, headers=headers).json()["token"]

    r1 = client.post(f"/api/agreement/{token}/respond", json={"action": "approve"})
    assert r1.status_code == 200
    assert r1.json()["status"] == "APPROVED"

    r2 = client.post(f"/api/agreement/{token}/respond", json={"action": "request_changes"})
    assert r2.status_code == 409


def test_owner_can_revoke_and_revoked_link_rejects_responses():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    token = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                        json={"option_id": "B", "project_title": "Revoke me"}, headers=headers).json()["token"]

    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement/{token}/revoke", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "REVOKED"

    r2 = client.get(f"/api/agreement/{token}")
    assert r2.json()["status"] == "REVOKED"

    r3 = client.post(f"/api/agreement/{token}/respond", json={"action": "approve"})
    assert r3.status_code == 410


def test_non_owner_cannot_revoke():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    token = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                        json={"option_id": "B", "project_title": "Protected"}, headers=headers).json()["token"]

    other_headers = _guest_headers()
    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement/{token}/revoke", headers=other_headers)
    assert r.status_code == 403


def test_approved_agreement_cannot_be_revoked():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    token = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                        json={"option_id": "B", "project_title": "Locked"}, headers=headers).json()["token"]
    client.post(f"/api/agreement/{token}/respond", json={"action": "approve"})

    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement/{token}/revoke", headers=headers)
    assert r.status_code == 409


def test_expired_agreement_reports_expired_and_rejects_responses():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    token = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement",
                        json={"option_id": "B", "project_title": "Old offer"}, headers=headers).json()["token"]
    _backdate_agreement(token)

    r = client.get(f"/api/agreement/{token}")
    assert r.json()["status"] == "EXPIRED"

    r2 = client.post(f"/api/agreement/{token}/respond", json={"action": "approve"})
    assert r2.status_code == 410


def test_agreement_requires_analysis_with_options():
    headers = _guest_headers()
    r = client.post("/api/analyze", json={"brief": "just a raw brief with no ai and no estimate step yet here"},
                    headers=headers)
    # Real (non-seed) briefs stay NEEDS_CLARIFICATION until /estimate is run, so no
    # options exist on the analysis yet.
    analysis_id = r.json()["analysis_id"]
    r2 = client.post(f"/api/analysis/{analysis_id}/agreement",
                     json={"option_id": "B", "project_title": "Too early"}, headers=headers)
    assert r2.status_code == 422
