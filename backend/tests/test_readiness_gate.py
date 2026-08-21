"""Readiness gate (master plan 1.3, principle #4): estimation only runs when
readiness_state is exactly "ready_to_estimate" -- never for an unsupported
profession, and never while a high-severity Generic Deal Rule issue is open,
no matter how "complete" the scope override dict looks."""
import os
import sys
import uuid

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

import server

client = TestClient(server.app)

FULLY_RESOLVED_OVERRIDES = {
    "quantity": 10, "final_duration": 30, "client_budget": 6_000_000,
    "deadline_working_days": 10, "revision_rounds": 2, "approver_count": 1,
    "footage_available": True, "footage_preselected": True,
}

COST_PROFILE = {
    "mode": "guided", "target_take_home": 8_000_000, "monthly_overhead": 1_500_000,
    "monthly_reserve": 900_000, "total_working_hours": 160, "billable_utilization": 0.65,
    "target_margin": 0.2,
}


def _guest_headers():
    return {"X-Guest-Id": f"guest_test_{uuid.uuid4().hex[:10]}"}


def _analyze(brief, headers):
    r = client.post("/api/analyze", json={"brief": brief, "use_ai": False}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_supported_profession_with_resolved_scope_gets_a_price():
    headers = _guest_headers()
    doc = _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)
    assert doc["support_level"] == "calibrated_estimation"

    r = client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": FULLY_RESOLVED_OVERRIDES,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["readiness_state"] == "ready_to_estimate"
    assert data["price"] is not None


def test_unsupported_profession_never_gets_a_price_even_with_full_scope():
    headers = _guest_headers()
    doc = _analyze(
        "Bikin website toko online, ada login, pembayaran, dashboard admin. Budget 6 juta, satu bulan.",
        headers,
    )
    assert doc["support_level"] == "critique_only"

    r = client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": FULLY_RESOLVED_OVERRIDES,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["readiness_state"] == "ready_scope_only"
    assert data["price"] is None
    assert data["options"] is None


def test_not_ready_to_quote_blocks_price_for_supported_profession():
    headers = _guest_headers()
    doc = _analyze("Need some Reels, revisi sampai cocok ya, budget nanti dibicarakan.", headers)
    assert doc["support_level"] == "calibrated_estimation"

    overrides = {**FULLY_RESOLVED_OVERRIDES, "revision_rounds": None}
    r = client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": overrides,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["readiness_state"] == "not_ready_to_quote"
    assert data["price"] is None


def test_acceptance_and_change_boundary_resolve_from_overrides():
    headers = _guest_headers()
    doc = _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)

    overrides = {
        **FULLY_RESOLVED_OVERRIDES,
        "acceptance_criteria": "approved once the final cut is delivered",
        "change_boundary": "concept changes after approval are new scope",
    }
    r = client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": overrides,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    rule_ids = [i["rule_id"] for i in data["deal_issues"]]
    assert "acceptance_criteria" not in rule_ids
    assert "change_boundary" not in rule_ids
    # Kedua field ini medium -> tidak boleh mengubah gerbang readiness.
    assert data["readiness_state"] == "ready_to_estimate"


def test_deal_terms_survive_reload():
    """D10: nilai yang dideklarasikan user harus bertahan di GET setelah estimate,
    karena build_scope() sengaja tidak membawanya di scope_used."""
    headers = _guest_headers()
    doc = _analyze("Need 10 Reels for a campaign, footage ready, budget 6M.", headers)
    overrides = {
        **FULLY_RESOLVED_OVERRIDES,
        "acceptance_criteria": "approved once the final cut is delivered",
        "change_boundary": "concept changes after approval are new scope",
    }
    client.post(f"/api/analysis/{doc['analysis_id']}/estimate", headers=headers, json={
        "cost_profile": COST_PROFILE, "scope_overrides": overrides,
    })
    r = client.get(f"/api/analysis/{doc['analysis_id']}", headers=headers)
    assert r.status_code == 200, r.text
    terms = r.json().get("deal_terms") or {}
    assert terms.get("acceptance_criteria") == "approved once the final cut is delivered"
    assert terms.get("change_boundary") == "concept changes after approval are new scope"
