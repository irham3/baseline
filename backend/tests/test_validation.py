"""Input validation tests (Phase 8): invalid input must return controlled 4xx, never 500."""
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


def _seed_analysis_id(headers):
    r = client.post("/api/analyze", json={
        "brief": "Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
                 "Budget is IDR 3M, ideally finished next week. Revisions until it feels right.",
        "use_ai": False,
    }, headers=headers)
    return r.json()["analysis_id"]


def test_estimate_with_unviable_budget_returns_200_not_500():
    # Regression: a client_budget too low for even one video used to crash the
    # /estimate endpoint with a 500 (TypeError in whatsapp_message on a None price).
    headers = _guest_headers()
    aid = _seed_analysis_id(headers)
    body = {
        "cost_profile": {"mode": "guided", "target_take_home": 8000000, "monthly_overhead": 1500000,
                         "monthly_reserve": 900000, "total_working_hours": 160, "billable_utilization": 0.65,
                         "target_margin": 0.2},
        "scope_overrides": {"quantity": 10, "final_duration": 60, "client_budget": 200000,
                            "deadline_working_days": 3, "revision_rounds": 3},
    }
    r = client.post(f"/api/analysis/{aid}/estimate", json=body, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    a = next(o for o in data["options"] if o["id"] == "A")
    assert a["type"] == "no_viable_scope"
    assert a["price"] is None
    assert data["whatsapp"] is not None
    assert "None" not in data["whatsapp"]["warm"]


def test_negative_quantity_returns_422_not_500():
    headers = _guest_headers()
    aid = _seed_analysis_id(headers)
    body = {
        "cost_profile": {"mode": "guided", "target_take_home": 8000000, "monthly_overhead": 1500000,
                         "monthly_reserve": 900000, "total_working_hours": 160, "billable_utilization": 0.65,
                         "target_margin": 0.2},
        "scope_overrides": {"quantity": -3, "final_duration": 30},
    }
    r = client.post(f"/api/analysis/{aid}/estimate", json=body, headers=headers)
    assert r.status_code == 422
    assert "detail" in r.json()


def test_billable_utilization_out_of_range_rejected_by_schema():
    headers = _guest_headers()
    aid = _seed_analysis_id(headers)
    body = {
        "cost_profile": {"mode": "guided", "billable_utilization": 1.5, "target_margin": 0.2},
        "scope_overrides": {"quantity": 5},
    }
    r = client.post(f"/api/analysis/{aid}/estimate", json=body, headers=headers)
    assert r.status_code == 422


def test_target_margin_of_one_rejected():
    headers = _guest_headers()
    aid = _seed_analysis_id(headers)
    body = {
        "cost_profile": {"mode": "guided", "cost_per_hour": 100000, "target_margin": 1.0},
        "scope_overrides": {"quantity": 5, "client_budget": 5000000},
    }
    r = client.post(f"/api/analysis/{aid}/estimate", json=body, headers=headers)
    assert r.status_code == 422


def test_brief_too_long_rejected():
    headers = _guest_headers()
    r = client.post("/api/analyze", json={"brief": "x" * 6001}, headers=headers)
    assert r.status_code == 422


def test_analytics_unknown_event_rejected():
    r = client.post("/api/analytics", json={"event": "totally_made_up_event", "props": {}})
    assert r.status_code == 422


def test_analytics_oversized_props_rejected():
    r = client.post("/api/analytics", json={"event": "estimate_viewed", "props": {"x": "y" * 5000}})
    assert r.status_code == 422


def test_analytics_allowed_event_ok():
    r = client.post("/api/analytics", json={"event": "estimate_viewed", "props": {"analysis_id": "abc"}})
    assert r.status_code == 200


def test_agreement_project_title_too_long_rejected():
    headers = _guest_headers()
    aid = _seed_analysis_id(headers)
    r = client.post(f"/api/analysis/{aid}/agreement",
                    json={"option_id": "B", "project_title": "x" * 500}, headers=headers)
    assert r.status_code == 422


def test_security_headers_present():
    r = client.get("/api/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
