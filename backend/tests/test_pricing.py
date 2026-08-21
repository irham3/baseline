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
    assert est["low"] == 45.4
    assert est["high"] == 52.8
    assert est["low"] <= est["high"]


def test_hour_range_ordering_holds():
    est = pricing.estimate_hours(scope_mod.resolved_seed_scope())
    for item in est["breakdown"]:
        assert item["low"] <= item["high"]


# ---- Final duration must affect hours (Phase 3A) ----
def test_longer_final_duration_estimates_more_hours():
    base = scope_mod.resolved_seed_scope()
    short = {**base, "final_duration": 15}
    long = {**base, "final_duration": 90}
    est_short = pricing.estimate_hours(short)
    est_long = pricing.estimate_hours(long)
    assert est_long["low"] > est_short["low"]
    assert est_long["high"] > est_short["high"]


def test_duration_multiplier_bands_are_monotonic():
    seconds = [10, 20, 45, 75, 120]
    mults = [pricing.duration_multiplier(s)[1] for s in seconds]
    assert mults == sorted(mults)


def test_missing_duration_uses_default_band():
    lo, hi, label = pricing.duration_multiplier(None)
    assert (lo, hi) == pricing.duration_multiplier(pricing.DEFAULT_DURATION_SECONDS)[:2]


# ---- Break-even & price floor ----
def test_seed_break_even_and_price_floor():
    scope = scope_mod.resolved_seed_scope()
    est = pricing.estimate_hours(scope)
    labor_mid = (est["low"] + est["high"]) / 2 * 100000
    price = pricing.price_estimate(est["low"], est["high"], 100000, 0.0,
                                   scope_mod.derive_buffers(scope, labor_mid), 0.20, 3000000)
    assert price["break_even_low"] == 5178300
    assert price["break_even_high"] == 5918300
    assert price["price_floor_low"] == 6472875
    assert price["price_floor_high"] == 7397875
    assert price["price_floor_gap_low"] == 3472875
    assert price["price_floor_gap_high"] == 4397875


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
    assert by_id["A"]["quantity"] == 4 and by_id["A"]["price"] == 3000000
    assert by_id["B"]["quantity"] == 12 and by_id["B"]["price"] == 7000000
    assert by_id["C"]["quantity"] == 12 and by_id["C"]["price"] == 9000000
    assert by_id["B"]["price"] >= by_id["B"]["price_floor_low"]


def test_every_priced_option_is_at_or_above_its_own_floor():
    opts = scope_mod.build_options(scope_mod.resolved_seed_scope(), 100000, 0.20, 3000000)
    for opt in opts:
        if opt.get("price") is None:
            continue
        if opt["type"] == "budget_fixed":
            # Option A only exists because the search already verified this quantity's
            # floor fits inside the client budget (the price shown IS the budget).
            assert opt["price_floor_high"] <= opt["price"]
        else:
            assert opt["price"] >= opt["price_floor_low"]


def test_deliverable_copy_reflects_actual_final_duration_not_a_hardcoded_value():
    scope = {**scope_mod.resolved_seed_scope(), "final_duration": 30}
    opts = scope_mod.build_options(scope, 100000, 0.20, 3000000)
    b = next(o for o in opts if o["id"] == "B")
    assert b["final_duration"] == 30
    line = scope_mod._deliverable_line(b)
    assert "30 seconds" in line
    assert "45 seconds" not in line

    snapshot = scope_mod.agreement_snapshot(b, "Test Project")
    joined = " ".join(snapshot["deliverables"])
    assert "30 seconds" in joined
    assert "45 seconds" not in joined


def test_options_carry_a_timeline_trace():
    opts = scope_mod.build_options(scope_mod.resolved_seed_scope(), 100000, 0.20, 3000000)
    for opt in opts:
        assert "timeline_trace" in opt
        if opt.get("price") is not None:
            assert opt["timeline_trace"] is not None
            assert opt["timeline_trace"][-1]["label"] == "Total working days"
            assert opt["timeline_days"] == opt["timeline_trace"][-1]["days"]


def test_no_viable_scope_when_budget_too_low_for_even_one_video():
    scope = scope_mod.resolved_seed_scope()
    opts = scope_mod.build_options(scope, 100000, 0.20, client_budget=100000)
    by_id = {o["id"]: o for o in opts}
    assert by_id["A"]["type"] == "no_viable_scope"
    assert by_id["A"]["price"] is None
    assert by_id["A"]["quantity"] == 0
    assert by_id["A"]["price_floor_low"] > 100000


def test_whatsapp_message_does_not_crash_when_option_a_has_no_price():
    # Regression: whatsapp_message() used to unconditionally format options[0]["price"],
    # which crashed with TypeError once Option A became "no_viable_scope" (price=None).
    scope = scope_mod.resolved_seed_scope()
    opts = scope_mod.build_options(scope, 100000, 0.20, client_budget=100000)
    for tone in ("warm", "firm", "formal"):
        msg = scope_mod.whatsapp_message(scope, opts, tone)
        assert isinstance(msg, str) and len(msg) > 0
        assert "None" not in msg


def test_budget_fixed_option_only_appears_when_actually_viable():
    scope = scope_mod.resolved_seed_scope()
    opts = scope_mod.build_options(scope, 100000, 0.20, client_budget=3000000)
    a = next(o for o in opts if o["id"] == "A")
    assert a["type"] == "budget_fixed"
    assert a["price_floor_high"] <= a["price"]


# ---- Timeline derivation (Phase 3B) ----
def test_timeline_scales_with_hours_and_capacity():
    fast = pricing.project_timeline(24, daily_capacity=8.0)
    slow = pricing.project_timeline(24, daily_capacity=4.0)
    assert slow["total_days"] > fast["total_days"]


def test_timeline_adds_days_for_unselected_footage_and_reviews():
    bare = pricing.project_timeline(20, footage_preselected=True, revision_rounds=0)
    fuller = pricing.project_timeline(20, footage_preselected=False, revision_rounds=2, approver_count=2)
    assert fuller["total_days"] > bare["total_days"]
    assert fuller["trace"][-1]["label"] == "Total working days"


def test_rush_timeline_stays_at_or_above_production_minimum():
    t = pricing.project_timeline(30, footage_preselected=False, revision_rounds=1, rush=True, daily_capacity=6.0)
    production_days = t["trace"][0]["days"]
    assert t["total_days"] >= production_days


# ---- Scale-aware buffers (Phase 3F) ----
def test_buffers_scale_with_labor_cost_but_respect_cap():
    scope = {"footage_available": True, "footage_preselected": False, "approver_count": 1, "rush": False}
    small = scope_mod.derive_buffers(scope, labor_cost=1_000_000)
    large = scope_mod.derive_buffers(scope, labor_cost=50_000_000)
    assert small[0]["amount"] < large[0]["amount"]
    assert large[0]["amount"] <= 750_000  # capped


def test_buffers_never_below_minimum():
    scope = {"footage_available": True, "footage_preselected": False}
    buf = scope_mod.derive_buffers(scope, labor_cost=0)
    assert buf[0]["amount"] == 150_000


def test_base_contingency_applies_when_no_other_buffer_triggers():
    scope = {"footage_available": True, "footage_preselected": True, "approver_count": 1, "rush": False}
    buf = scope_mod.derive_buffers(scope, labor_cost=1_000_000)
    assert len(buf) == 1
    assert "Base contingency" in buf[0]["label"]


# ---- Scope completeness consistency (Phase 3D) ----
def test_completeness_no_magic_offsets():
    full = scope_mod.resolved_seed_scope()
    c = scope_mod.compute_scope_completeness(full)
    assert c["resolved"] == len(scope_mod.REQUIRED_FIELDS)
    assert c["percent"] == 100


def test_completeness_partial_overrides_counted_honestly():
    partial = {"quantity": 12, "client_budget": 3000000}
    c = scope_mod.compute_scope_completeness(partial)
    assert c["resolved"] == 2
    assert c["total"] == len(scope_mod.REQUIRED_FIELDS)


def test_completeness_treats_defaults_as_unresolved():
    # footage_available/subtitles default to True inside build_scope() when absent from
    # the raw override dict -- completeness must not count that silent default as resolved.
    raw_overrides = {"quantity": 5}
    built_scope = {**raw_overrides, "footage_available": True, "subtitles": True}
    assert scope_mod.compute_scope_completeness(raw_overrides)["resolved"] == 1
    assert scope_mod.compute_scope_completeness(built_scope)["resolved"] == 3


def test_seed_and_manual_completeness_agree():
    seed = scope_mod.compute_seed_analysis()
    manual = scope_mod.compute_scope_completeness(scope_mod.resolved_seed_scope())
    assert seed["scope_completeness"] == manual


# ---- Redaction ----
def test_redaction_phone_and_email():
    text = "Hubungi 081234567890 atau email owner@brand.co.id ya"
    out = scope_mod.redact_pii(text)
    assert "081234567890" not in out["text"]
    assert "owner@brand.co.id" not in out["text"]
    assert out["phones_found"] == 1
    assert out["emails_found"] == 1


def test_redaction_url():
    text = "Lihat portofolio di https://myportfolio.com/reels dan www.example.co.id"
    out = scope_mod.redact_pii(text)
    assert "myportfolio.com" not in out["text"]
    assert "example.co.id" not in out["text"]
    assert out["urls_found"] == 2


def test_redaction_social_handle():
    text = "DM aja ke @brand_official atau @editor.reels untuk detail"
    out = scope_mod.redact_pii(text)
    assert "@brand_official" not in out["text"]
    assert "@editor.reels" not in out["text"]
    assert out["handles_found"] == 2


def test_redaction_bank_account_number():
    text = "Transfer ke rekening 1234567890123 BCA ya"
    out = scope_mod.redact_pii(text)
    assert "1234567890123" not in out["text"]
    assert out["accounts_found"] == 1


def test_redaction_does_not_over_redact_short_budget_numbers():
    text = "Budget 3000000 rupiah"
    out = scope_mod.redact_pii(text)
    assert "3000000" in out["text"]
    assert out["accounts_found"] == 0


def test_redaction_combined_total():
    text = "Halo, hubungi 081234567890, email saya test@brand.id, IG @brandbaru, web https://brand.id"
    out = scope_mod.redact_pii(text)
    assert out["total"] == 4
    assert out["total"] == (out["emails_found"] + out["phones_found"] + out["urls_found"] + out["handles_found"] + out["accounts_found"])
