"""Edge-case probes: non-viable Option A (budget far below any price floor)."""
from __future__ import annotations

import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")

SEED_BRIEF = (
    "Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
    "Budget is IDR 3M, ideally finished next week. Revisions until it feels right."
)
CP = {"mode": "guided", "target_take_home": 8000000, "monthly_overhead": 1500000,
      "monthly_reserve": 900000, "total_working_hours": 160,
      "billable_utilization": 0.65, "target_margin": 0.20}


@pytest.fixture(scope="module")
def ctx():
    s = requests.Session()
    gid = f"guest_nonviable_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{BASE_URL}/api/analyze", json={"brief": SEED_BRIEF, "use_ai": False},
               headers={"X-Guest-Id": gid}, timeout=60)
    assert r.status_code == 200, r.text[:300]
    return s, gid, r.json()["analysis_id"]


def _estimate(ctx, budget):
    s, gid, aid = ctx
    body = {"cost_profile": CP, "scope_overrides": {
        "quantity": 12, "final_duration": 45, "footage_preselected": False, "footage_hours": 3,
        "subtitles": True, "motion_level": "basic", "approver_count": 2,
        "revision_rounds": 2, "client_budget": budget}}
    return s.post(f"{BASE_URL}/api/analysis/{aid}/estimate", json=body,
                  headers={"X-Guest-Id": gid}, timeout=60)


def test_tiny_budget_estimate_does_not_500(ctx):
    r = _estimate(ctx, 100000)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:600]}"
    data = r.json()
    a = data["options"][0]
    assert a["viable"] is False, a
    assert a["price"] is None, a
    assert a["type"] == "no_viable_scope", a


def test_non_viable_option_cannot_become_agreement(ctx):
    s, gid, aid = ctx
    r = _estimate(ctx, 100000)
    if r.status_code != 200:
        pytest.skip("estimate failed; covered by previous test")
    ag = s.post(f"{BASE_URL}/api/analysis/{aid}/agreement",
                json={"option_id": "A", "project_title": "should fail"},
                headers={"X-Guest-Id": gid}, timeout=30)
    assert ag.status_code == 422, f"{ag.status_code}: {ag.text[:400]}"
