"""Deterministic engine tests. Run: /root/.venv/bin/python -m pytest tests/ -q"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import pricing
import scope as scope_mod


# ---- Cost profile ----
def test_productive_cost_per_hour_seed():
    cph = pricing.productive_cost_per_hour(8000000, 1500000, 900000, 160, 0.65)
    assert cph == 100000  # (10,400,000 / 104)


def test_realistic_billable_hours():
    assert pricing.realistic_billable_hours(160, 0.65) == 104


def test_zero_billable_hours_rejected():
    with pytest.raises(ValueError):
        pricing.realistic_billable_hours(0, 0.65)


def test_utilization_out_of_range_rejected():
    with pytest.raises(ValueError):
        pricing.productive_cost_per_hour(1, 1, 1, 160, 1.5)


# ---- Hours & ordering ----
def test_seed_hours_range():
    est = pricing.estimate_hours(scope_mod.resolved_seed_scope())
    assert est["low"] == 37.0
    assert est["high"] == 42.0
    assert est["low"] <= est["high"]


def test_hour_range_ordering_holds():
    est = pricing.estimate_hours(scope_mod.resolved_seed_scope())
    for item in est["breakdown"]:
        assert item["low"] <= item["high"]


# ---- Break-even & price floor ----
def test_seed_break_even_and_price_floor():
    scope = scope_mod.resolved_seed_scope()
    est = pricing.estimate_hours(scope)
    price = pricing.price_estimate(est["low"], est["high"], 100000, 0.0,
                                   scope_mod.derive_buffers(scope), 0.20, 3000000)
    assert price["break_even_low"] == 4100000
    assert price["break_even_high"] == 4600000
    assert price["price_floor_low"] == 5125000
    assert price["price_floor_high"] == 5750000
    assert price["price_floor_gap_low"] == 2125000
    assert price["price_floor_gap_high"] == 2750000


def test_price_floor_low_le_high():
    price = pricing.price_estimate(37, 42, 100000, 0, [], 0.2)
    assert price["price_floor_low"] <= price["price_floor_high"]


# ---- Target margin edge cases ----
def test_target_margin_zero_ok():
    price = pricing.price_estimate(10, 10, 100000, 0, [], 0.0)
    assert price["price_floor_low"] == price["break_even_low"]


def test_target_margin_one_rejected():
    with pytest.raises(ValueError):
        pricing.price_estimate(10, 10, 100000, 0, [], 1.0)


def test_negative_currency_rejected():
    with pytest.raises(ValueError):
        pricing.price_estimate(10, 10, -1, 0, [], 0.2)
    with pytest.raises(ValueError):
        pricing.price_estimate(10, 10, 100000, -5, [], 0.2)


# ---- Scope completeness ----
def test_scope_completeness_seed():
    c = pricing.scope_completeness(13, 15)
    assert c["percent"] == 87


def test_scope_completeness_bounds():
    with pytest.raises(ValueError):
        pricing.scope_completeness(20, 15)


# ---- Risk triggers ----
def test_seed_risk_is_high_with_triggers():
    scope = scope_mod.resolved_seed_scope()
    est = pricing.estimate_hours(scope)
    price = pricing.price_estimate(est["low"], est["high"], 100000, 0,
                                   scope_mod.derive_buffers(scope), 0.20, 3000000)
    risk = pricing.risk_triggers(scope, est, price)
    codes = {t["code"] for t in risk["triggers"]}
    assert risk["level"] == "high"
    assert "budget_below_break_even" in codes
    assert "rush_deadline" in codes


def test_unlimited_revision_trigger():
    scope = {**scope_mod.resolved_seed_scope(), "revision_rounds": None}
    est = pricing.estimate_hours(scope)
    price = pricing.price_estimate(est["low"], est["high"], 100000, 0, [], 0.2, 3000000)
    risk = pricing.risk_triggers(scope, est, price)
    assert any(t["code"] == "unlimited_revisions" for t in risk["triggers"])


# ---- Options ----
def test_options_match_illustrative_plan():
    opts = scope_mod.build_options(scope_mod.resolved_seed_scope(), 100000, 0.20, 3000000)
    by_id = {o["id"]: o for o in opts}
    assert by_id["A"]["quantity"] == 6 and by_id["A"]["price"] == 3000000
    assert by_id["B"]["quantity"] == 12 and by_id["B"]["price"] == 5500000
    assert by_id["C"]["quantity"] == 12 and by_id["C"]["price"] == 6500000
    assert by_id["B"]["price"] >= by_id["B"]["price_floor_low"]


# ---- Duration effort model (FORMULA_VERSION 1.1.0) ----
def test_duration_affects_hours():
    base = scope_mod.resolved_seed_scope()
    short = pricing.estimate_hours({**base, "final_duration": 15})
    long = pricing.estimate_hours({**base, "final_duration": 90})
    assert short["low"] < long["low"]
    assert short["high"] < long["high"]


def test_duration_reference_45s_is_neutral():
    # 45s is the neutral reference (multiplier 1.0) so the seed baseline is unchanged.
    est = pricing.estimate_hours(scope_mod.resolved_seed_scope())
    assert est["duration_multiplier"] == 1.0
    assert est["low"] == 37.0 and est["high"] == 42.0


def test_duration_multiplier_bands_monotonic():
    m15, _ = pricing.duration_multiplier(15)
    m45, _ = pricing.duration_multiplier(45)
    m90, _ = pricing.duration_multiplier(90)
    m200, _ = pricing.duration_multiplier(200)
    assert m15 < m45 <= m90 < m200


# ---- Option A viability (no fake budget-fit option) ----
def test_no_viable_scope_when_budget_impossible():
    opts = scope_mod.build_options(scope_mod.resolved_seed_scope(), 100000, 0.20, 200000)
    a = next(o for o in opts if o["id"] == "A")
    assert a["viable"] is False
    assert a["type"] == "no_viable_scope"
    assert a["price"] is None
    # Its own floor must be strictly above the impossible budget.
    assert a["price_floor_high"] > 200000


def test_no_option_priced_below_its_own_floor():
    opts = scope_mod.build_options(scope_mod.resolved_seed_scope(), 100000, 0.20, 3000000)
    for o in opts:
        if o.get("viable", True) and o.get("price") is not None:
            assert o["price"] >= o["price_floor_low"]


# ---- Agreement snapshot must never leak internal cost data ----
def test_agreement_snapshot_has_no_internal_cost():
    opts = scope_mod.build_options(scope_mod.resolved_seed_scope(), 100000, 0.20, 3000000)
    b = next(o for o in opts if o["id"] == "B")
    snap = scope_mod.agreement_snapshot(b, "Test project")
    forbidden = {"cost_per_hour", "labor_cost_low", "labor_cost_high", "break_even_low",
                 "break_even_high", "target_margin", "price_floor_low", "price_floor_high", "buffers"}
    assert forbidden.isdisjoint(snap.keys())
    assert snap["price"] == b["price"]

    text = "Hubungi 081234567890 atau email owner@brand.co.id ya"
    out = scope_mod.redact_pii(text)
    assert "081234567890" not in out["text"]
    assert "owner@brand.co.id" not in out["text"]
    assert out["phones_found"] == 1
    assert out["emails_found"] == 1
