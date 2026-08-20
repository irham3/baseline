"""API-level regression tests for Baseline integrity slice (formula 1.1.0).

Covers: health, demo seed pricing, guest analyze flow, agreement tamper resistance,
agreement state machine (approve/lock/revoke), and internal-cost leak checks.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = _base.rstrip("/")

SEED_BRIEF = (
    "Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
    "Budget is IDR 3M, ideally finished next week. Revisions until it feels right."
)

LEAK_KEYS = [
    "cost_per_hour", "labor_cost_low", "labor_cost_high", "break_even_low", "break_even_high",
    "target_margin", "price_floor_low", "price_floor_high", "buffers",
]


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def guest_a():
    return f"guest_testA_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def guest_b():
    return f"guest_testB_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def analysis(client, guest_a):
    """Guest analyze (seed path, no AI) -> persisted analysis with options+estimate."""
    r = client.post(f"{BASE_URL}/api/analyze",
                    json={"brief": SEED_BRIEF, "use_ai": False},
                    headers={"X-Guest-Id": guest_a}, timeout=60)
    assert r.status_code == 200, f"analyze failed: {r.status_code} {r.text[:400]}"
    data = r.json()
    assert data.get("analysis_id")
    assert data.get("options") and len(data["options"]) == 3
    assert data.get("estimate")
    return data


def _created_agreement(client, analysis_id, guest, body):
    return client.post(f"{BASE_URL}/api/analysis/{analysis_id}/agreement",
                       json=body, headers={"X-Guest-Id": guest}, timeout=30)


# ---------------- health ----------------
class TestHealth:
    def test_health(self, client):
        r = client.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") == "ok", d
        assert d.get("formula_version") == "1.1.0", d


# ---------------- pricing / demo seed ----------------
class TestDemoSeedPricing:
    @pytest.fixture(scope="class")
    def seed(self, client):
        r = client.get(f"{BASE_URL}/api/demo/seed", timeout=60)
        assert r.status_code == 200, r.text[:400]
        return r.json()

    def test_estimate_duration_neutral(self, seed):
        est = seed["estimate"]
        assert est["duration_multiplier"] == 1.0, est
        assert est["low"] == 37.0, est
        assert est["high"] == 42.0, est

    def test_formula_version(self, seed):
        assert seed["formula_version"] == "1.1.0"

    def test_three_options(self, seed):
        assert len(seed["options"]) == 3
        assert [o["id"] for o in seed["options"]] == ["A", "B", "C"]

    def test_option_a_viable(self, seed):
        a = seed["options"][0]
        assert a.get("viable") is True, a
        assert a["quantity"] == 6, a
        assert a["price"] == 3000000, a

    def test_no_option_below_its_price_floor_low(self, seed):
        for o in seed["options"]:
            if o.get("price") is None:
                continue
            assert o["price"] >= o["price_floor_low"], f"Option {o['id']} priced below its floor: {o}"

    def test_duration_affects_hours_90s_vs_15s(self, client):
        """Longer final duration must estimate more hours (via /estimate endpoint)."""
        r = client.post(f"{BASE_URL}/api/analyze", json={"brief": SEED_BRIEF, "use_ai": False},
                        headers={"X-Guest-Id": f"guest_dur_{uuid.uuid4().hex[:8]}"}, timeout=60)
        assert r.status_code == 200
        aid = r.json()["analysis_id"]
        gid = r.request.headers["X-Guest-Id"]
        cp = {"mode": "guided", "target_take_home": 8000000, "monthly_overhead": 1500000,
              "monthly_reserve": 900000, "total_working_hours": 160,
              "billable_utilization": 0.65, "target_margin": 0.20}

        def hours(duration):
            body = {"cost_profile": cp, "scope_overrides": {
                "quantity": 12, "final_duration": duration, "footage_preselected": False,
                "footage_hours": 3, "subtitles": True, "motion_level": "basic",
                "approver_count": 2, "revision_rounds": 2, "client_budget": 3000000}}
            rr = client.post(f"{BASE_URL}/api/analysis/{aid}/estimate", json=body,
                             headers={"X-Guest-Id": gid}, timeout=60)
            assert rr.status_code == 200, rr.text[:400]
            return rr.json()["estimate"]

        short, long = hours(15), hours(90)
        assert long["low"] > short["low"], (short, long)
        assert long["high"] > short["high"], (short, long)
        assert long["duration_multiplier"] > short["duration_multiplier"]


# ---------------- agreement creation / tamper resistance ----------------
class TestAgreementTamperResistance:
    def test_create_agreement_option_b(self, client, analysis, guest_a):
        r = _created_agreement(client, analysis["analysis_id"], guest_a,
                               {"option_id": "B", "project_title": "QA test"})
        assert r.status_code == 200, r.text[:400]
        d = r.json()
        assert d["status"] == "SENT"
        assert isinstance(d["token"], str) and len(d["token"]) > 10

    def test_tampered_fields_ignored(self, client, analysis, guest_a):
        server_b = next(o for o in analysis["options"] if o["id"] == "B")
        r = _created_agreement(client, analysis["analysis_id"], guest_a,
                               {"option_id": "B", "project_title": "QA", "price": 1, "quantity": 999})
        assert r.status_code == 200, r.text[:400]
        token = r.json()["token"]
        g = client.get(f"{BASE_URL}/api/agreement/{token}", timeout=30)
        assert g.status_code == 200
        snap = g.json()["snapshot"]
        assert snap["price"] == server_b["price"], snap
        assert snap["price"] != 1
        assert snap["quantity"] == 12, snap

    def test_unknown_option_id_422(self, client, analysis, guest_a):
        r = _created_agreement(client, analysis["analysis_id"], guest_a,
                               {"option_id": "Z", "project_title": "x"})
        assert r.status_code == 422, f"{r.status_code} {r.text[:300]}"

    def test_other_guest_forbidden_403(self, client, analysis, guest_b):
        r = _created_agreement(client, analysis["analysis_id"], guest_b,
                               {"option_id": "B", "project_title": "x"})
        assert r.status_code == 403, f"{r.status_code} {r.text[:300]}"

    def test_no_internal_cost_leak(self, client, analysis, guest_a):
        r = _created_agreement(client, analysis["analysis_id"], guest_a,
                               {"option_id": "B", "project_title": "leak check"})
        token = r.json()["token"]
        g = client.get(f"{BASE_URL}/api/agreement/{token}", timeout=30)
        body = g.json()
        snap = body["snapshot"]
        leaked = [k for k in LEAK_KEYS if k in snap]
        assert not leaked, f"Internal cost data leaked in snapshot: {leaked}"
        assert body.get("snapshot_hash"), body
        assert body.get("formula_version") == "1.1.0", body


# ---------------- state machine ----------------
class TestAgreementStateMachine:
    @pytest.fixture
    def token(self, client, analysis, guest_a):
        r = _created_agreement(client, analysis["analysis_id"], guest_a,
                               {"option_id": "B", "project_title": "state machine"})
        assert r.status_code == 200, r.text[:400]
        return r.json()["token"]

    def test_approve_then_locked_409(self, client, token):
        r = client.post(f"{BASE_URL}/api/agreement/{token}/respond",
                        json={"action": "approve"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "APPROVED"

        g = client.get(f"{BASE_URL}/api/agreement/{token}", timeout=30)
        assert g.json()["status"] == "APPROVED"

        r2 = client.post(f"{BASE_URL}/api/agreement/{token}/respond",
                         json={"action": "request_changes"}, timeout=30)
        assert r2.status_code == 409, f"{r2.status_code} {r2.text[:300]}"

    def test_revoke_then_respond_410(self, client, analysis, guest_a, token):
        aid = analysis["analysis_id"]
        r = client.post(f"{BASE_URL}/api/analysis/{aid}/agreement/{token}/revoke",
                        headers={"X-Guest-Id": guest_a}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "REVOKED"

        g = client.get(f"{BASE_URL}/api/agreement/{token}", timeout=30)
        assert g.json()["status"] == "REVOKED"

        r2 = client.post(f"{BASE_URL}/api/agreement/{token}/respond",
                         json={"action": "approve"}, timeout=30)
        assert r2.status_code == 410, f"{r2.status_code} {r2.text[:300]}"

    def test_revoke_requires_owner(self, client, analysis, guest_b, token):
        aid = analysis["analysis_id"]
        r = client.post(f"{BASE_URL}/api/analysis/{aid}/agreement/{token}/revoke",
                        headers={"X-Guest-Id": guest_b}, timeout=30)
        assert r.status_code == 403, f"{r.status_code} {r.text[:300]}"

    def test_request_changes_then_approve_allowed(self, client, token):
        r = client.post(f"{BASE_URL}/api/agreement/{token}/respond",
                        json={"action": "request_changes", "message": "please adjust"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["status"] == "CHANGE_REQUESTED"
        r2 = client.post(f"{BASE_URL}/api/agreement/{token}/respond",
                         json={"action": "approve"}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["status"] == "APPROVED"

    def test_invalid_action_422(self, client, token):
        r = client.post(f"{BASE_URL}/api/agreement/{token}/respond",
                        json={"action": "nonsense_action"}, timeout=30)
        assert r.status_code == 422, f"{r.status_code} {r.text[:300]}"

    def test_unknown_token_404(self, client):
        r = client.get(f"{BASE_URL}/api/agreement/does-not-exist-xyz", timeout=30)
        assert r.status_code == 404


# ---------------- misc guards ----------------
class TestMiscGuards:
    def test_analyze_short_brief_422(self, client, guest_a):
        r = client.post(f"{BASE_URL}/api/analyze", json={"brief": "hi", "use_ai": False},
                        headers={"X-Guest-Id": guest_a}, timeout=30)
        assert r.status_code == 422

    def test_analyze_response_has_no_mongo_id(self, client, analysis):
        assert "_id" not in analysis

    def test_demo_agreement_flow(self, client):
        r = client.post(f"{BASE_URL}/api/demo/agreement",
                        json={"option_id": "B", "project_title": "TEST_demo"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        token = r.json()["token"]
        g = client.get(f"{BASE_URL}/api/agreement/{token}", timeout=30)
        assert g.status_code == 200
        body = g.json()
        assert body["snapshot"]["is_demo"] is True
        assert body["formula_version"] == "1.1.0"
        assert body.get("snapshot_hash")
        assert not [k for k in LEAK_KEYS if k in body["snapshot"]]

    def test_agreement_on_unknown_analysis_404(self, client, guest_a):
        r = _created_agreement(client, uuid.uuid4().hex, guest_a,
                               {"option_id": "B", "project_title": "x"})
        assert r.status_code == 404, f"{r.status_code} {r.text[:300]}"
