"""Reusable client profiles + rate card (master plan post-contest, safe subset):
both are derived straight from the owner's own real scope_agreements -- never a
new collection, never external/scraped data."""
import os
import sys
import uuid

os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("ENVIRONMENT", "test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

import server

client = TestClient(server.app)

SEED_BRIEF_TEXT = ("Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
                    "Budget is IDR 3M, ideally finished next week. Revisions until it feels right.")


def _guest_headers():
    return {"X-Guest-Id": f"guest_test_{uuid.uuid4().hex[:10]}"}


def _create_seed_analysis(headers):
    r = client.post("/api/analyze", json={"brief": SEED_BRIEF_TEXT, "use_ai": False}, headers=headers)
    assert r.status_code == 200
    return r.json()


def test_rate_card_and_clients_populate_from_real_agreement():
    headers = _guest_headers()
    analysis = _create_seed_analysis(headers)
    real_option_b = next(o for o in analysis["options"] if o["id"] == "B")

    r = client.post(f"/api/analysis/{analysis['analysis_id']}/agreement", headers=headers, json={
        "option_id": "B", "project_title": "August Reels Campaign", "client_name": "PT Kopi Nusantara",
    })
    assert r.status_code == 200, r.text

    clients = client.get("/api/clients", headers=headers).json()["clients"]
    assert clients == ["PT Kopi Nusantara"]

    items = client.get("/api/rate-card", headers=headers).json()["items"]
    assert len(items) == 1
    assert items[0]["project_title"] == "August Reels Campaign"
    assert items[0]["price_per_unit"] == round(real_option_b["price"] / real_option_b["quantity"])


def test_demo_agreements_excluded_from_rate_card():
    headers = _guest_headers()
    r = client.post("/api/demo/agreement", headers=headers, json={})
    assert r.status_code == 200, r.text

    items = client.get("/api/rate-card", headers=headers).json()["items"]
    assert items == []


def test_clients_and_rate_card_scoped_to_owner():
    headers_a = _guest_headers()
    headers_b = _guest_headers()
    analysis = _create_seed_analysis(headers_a)
    client.post(f"/api/analysis/{analysis['analysis_id']}/agreement", headers=headers_a, json={
        "option_id": "B", "project_title": "Owner A project", "client_name": "Owner A's client",
    })

    assert client.get("/api/clients", headers=headers_b).json()["clients"] == []
    assert client.get("/api/rate-card", headers=headers_b).json()["items"] == []
