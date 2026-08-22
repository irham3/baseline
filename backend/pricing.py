"""
Baseline deterministic pricing & scope engine.

Pure, testable math. NO LLM calls happen here. Every monetary number the product
shows must originate from these functions so it can be traced to visible assumptions.
"""
from __future__ import annotations

import math
from typing import Optional

FORMULA_VERSION = "1.1.0"

# Default daily productive capacity (hours) used for deadline feasibility and timeline math.
# This is a configurable operational assumption (a solo editor's realistic focused hours per
# working day), not a universal market truth. Freelancers with different setups can differ.
DAILY_CAPACITY_HOURS = 6.0


def _require(cond: bool, msg: str) -> None:
    if not cond:
        raise ValueError(msg)


# --------------------------------------------------------------------------
# Cost profile
# --------------------------------------------------------------------------
def realistic_billable_hours(total_working_hours: float, billable_utilization: float) -> float:
    _require(total_working_hours > 0, "Total working hours must be greater than 0")
    _require(0 < billable_utilization <= 1, "Billable utilization must be > 0 and <= 1")
    return total_working_hours * billable_utilization


def productive_cost_per_hour(
    target_take_home: float,
    monthly_overhead: float,
    monthly_reserve: float,
    total_working_hours: float,
    billable_utilization: float,
) -> float:
    for name, v in (
        ("target_take_home", target_take_home),
        ("monthly_overhead", monthly_overhead),
        ("monthly_reserve", monthly_reserve),
    ):
        _require(v >= 0, f"{name} must be non-negative")
    rbh = realistic_billable_hours(total_working_hours, billable_utilization)
    _require(rbh > 0, "Realistic billable hours must be greater than 0")
    return (target_take_home + monthly_overhead + monthly_reserve) / rbh


# --------------------------------------------------------------------------
# Task-unit hour model (short-form video only)
# --------------------------------------------------------------------------
# Each entry is (low_hours, high_hours). Named and visible; no hidden multipliers.
TASK_UNITS = {
    "intake": (1.5, 1.5),
    "footage_preselected": (0.5, 1.0),
    "footage_per_raw_hour": (1.6666667, 2.0),  # applied per hour of raw footage when NOT pre-selected
    "rough_cut": (0.8, 0.9),
    "fine_cut": (0.55, 0.6),
    "export_qc": (0.10, 0.10),
    "subtitle": (0.30, 0.35),
    "audio_cleanup": (0.15, 0.15),
    "color_correction": (0.10, 0.15),
    "motion_custom": (0.6, 1.0),
    "approver_each": (1.0, 1.25),
    "revision_per_round": (2.25, 2.5),
    "scripting": (3.0, 4.0),
}

# When revisions are unlimited/undefined we must still estimate; assume this many rounds
# and flag the risk trigger separately.
ASSUMED_UNLIMITED_REVISION_ROUNDS = 3

# Default final duration (seconds) assumed when the brief never states or resolves it.
# 30s is the reference length: it carries the 1.0x multiplier below.
DEFAULT_DURATION_SECONDS = 30.0

# Duration bands scale the per-video editing bundle (rough cut, fine cut, export/QC,
# subtitle, audio, color, motion). Longer final videos need more cutting, pacing, and
# QA time even when quantity and complexity toggles are unchanged. Bands are a named,
# explainable, configurable operational assumption -- not a universal market constant.
# Each entry: (max_seconds_inclusive_or_None, (low_multiplier, high_multiplier), label).
DURATION_BANDS = [
    (15, (0.70, 0.75), "up to 15s"),
    (30, (1.00, 1.00), "16-30s (reference length)"),
    (60, (1.35, 1.40), "31-60s"),
    (90, (1.65, 1.75), "61-90s"),
    (None, (1.90, 2.05), "91s+"),
]


def duration_multiplier(final_duration_seconds) -> tuple[float, float, str]:
    """Return (low_multiplier, high_multiplier, band_label) for a final video duration."""
    d = float(final_duration_seconds) if final_duration_seconds else DEFAULT_DURATION_SECONDS
    _require(d > 0, "Final duration must be greater than 0")
    for max_s, (lo, hi), label in DURATION_BANDS:
        if max_s is None or d <= max_s:
            return lo, hi, label
    return DURATION_BANDS[-1][1][0], DURATION_BANDS[-1][1][1], DURATION_BANDS[-1][2]


def estimate_hours(scope: dict) -> dict:
    """Compute an hour range from a resolved scope state. Returns low/high + named breakdown."""
    q = int(scope.get("quantity") or 0)
    _require(q >= 0, "Quantity must be non-negative")

    items: list[dict] = []

    def add(label: str, low: float, high: float):
        _require(low <= high, f"Invalid ordering for {label}")
        items.append({"label": label, "low": round(low, 3), "high": round(high, 3)})

    def plural(value: int, singular: str, plural_label: str | None = None) -> str:
        return singular if value == 1 else (plural_label or f"{singular}s")

    # Per project
    add("Intake & asset management", *TASK_UNITS["intake"])

    # Footage handling
    if scope.get("footage_preselected"):
        add("Footage handover check (pre-selected)", *TASK_UNITS["footage_preselected"])
    else:
        fh = float(scope.get("footage_hours") or 0)
        lo = fh * TASK_UNITS["footage_per_raw_hour"][0]
        hi = fh * TASK_UNITS["footage_per_raw_hour"][1]
        add(f"Footage review & selection ({fh:g}h raw, not pre-selected)", lo, hi)

    # Scripting (per project, opt-in)
    if scope.get("scripting"):
        add("Scripting / storyboarding", *TASK_UNITS["scripting"])

    # Per-video editing bundle
    base_low = TASK_UNITS["rough_cut"][0] + TASK_UNITS["fine_cut"][0] + TASK_UNITS["export_qc"][0]
    base_high = TASK_UNITS["rough_cut"][1] + TASK_UNITS["fine_cut"][1] + TASK_UNITS["export_qc"][1]
    parts = ["rough cut", "fine cut", "export/QC"]
    if scope.get("subtitles", True):
        base_low += TASK_UNITS["subtitle"][0]
        base_high += TASK_UNITS["subtitle"][1]
        parts.append("subtitle")
    if scope.get("audio_cleanup", True):
        base_low += TASK_UNITS["audio_cleanup"][0]
        base_high += TASK_UNITS["audio_cleanup"][1]
        parts.append("audio")
    if scope.get("color_correction", True):
        base_low += TASK_UNITS["color_correction"][0]
        base_high += TASK_UNITS["color_correction"][1]
        parts.append("color")
    if scope.get("motion_level") == "custom":
        base_low += TASK_UNITS["motion_custom"][0]
        base_high += TASK_UNITS["motion_custom"][1]
        parts.append("motion graphics")

    dur_lo_mult, dur_hi_mult, dur_label = duration_multiplier(scope.get("final_duration"))
    base_low *= dur_lo_mult
    base_high *= dur_hi_mult
    add(
        f"Editing x {q} {plural(q, 'video')} ({', '.join(parts)}; duration band {dur_label}, "
        f"x{dur_lo_mult:g}-{dur_hi_mult:g})",
        base_low * q, base_high * q,
    )

    # Communication & approval
    ac = int(scope.get("approver_count") or 1)
    _require(ac >= 1, "Approver count must be at least 1")
    add(
        f"Communication & approval ({ac} {plural(ac, 'approver')})",
        ac * TASK_UNITS["approver_each"][0],
        ac * TASK_UNITS["approver_each"][1],
    )

    # Revision rounds
    rr = scope.get("revision_rounds")
    if rr is None:
        rr_used = ASSUMED_UNLIMITED_REVISION_ROUNDS
        label = f"Revision rounds x {rr_used} (assumed; not bounded in brief)"
    else:
        rr_used = int(rr)
        _require(rr_used >= 0, "Revision rounds must be non-negative")
        label = f"Revision rounds x {rr_used}"
    if rr_used > 0:
        add(label, rr_used * TASK_UNITS["revision_per_round"][0], rr_used * TASK_UNITS["revision_per_round"][1])

    low = sum(i["low"] for i in items)
    high = sum(i["high"] for i in items)
    return {"low": round(low, 1), "high": round(high, 1), "breakdown": items}


# --------------------------------------------------------------------------
# Pricing formulas
# --------------------------------------------------------------------------
def price_estimate(
    hours_low: float,
    hours_high: float,
    cost_per_hour: float,
    direct_costs: float,
    buffers: list[dict],
    target_margin: float,
    client_budget: Optional[float] = None,
) -> dict:
    """
    Labor -> Break-even -> Price floor. Every buffer is named. No hidden multiplier.
    `buffers` is a list of {"label": str, "amount": number}.
    """
    _require(0 <= target_margin < 1, "Target margin must be >= 0 and < 1")
    _require(cost_per_hour >= 0, "Cost per hour must be non-negative")
    _require(direct_costs >= 0, "Direct costs must be non-negative")
    _require(hours_low <= hours_high, "Hour range ordering is invalid")
    for b in buffers:
        _require(b["amount"] >= 0, f"Buffer '{b.get('label')}' must be non-negative")

    buffer_total = sum(b["amount"] for b in buffers)

    labor_low = hours_low * cost_per_hour
    labor_high = hours_high * cost_per_hour

    be_low = labor_low + direct_costs + buffer_total
    be_high = labor_high + direct_costs + buffer_total

    divisor = 1 - target_margin
    pf_low = be_low / divisor
    pf_high = be_high / divisor

    result = {
        "cost_per_hour": round(cost_per_hour),
        "labor_cost_low": round(labor_low),
        "labor_cost_high": round(labor_high),
        "direct_costs": round(direct_costs),
        "buffers": buffers,
        "buffer_total": round(buffer_total),
        "break_even_low": round(be_low),
        "break_even_high": round(be_high),
        "target_margin": target_margin,
        "price_floor_low": round(pf_low),
        "price_floor_high": round(pf_high),
    }
    if client_budget is not None:
        result["client_budget"] = round(client_budget)
        result["price_floor_gap_low"] = round(max(0, pf_low - client_budget))
        result["price_floor_gap_high"] = round(max(0, pf_high - client_budget))
    return result


# --------------------------------------------------------------------------
# Scope completeness & risk triggers
# --------------------------------------------------------------------------
def scope_completeness(resolved_required: int, total_required: int) -> dict:
    _require(total_required > 0, "Total required fields must be greater than 0")
    _require(0 <= resolved_required <= total_required, "Resolved must be within [0, total]")
    ratio = resolved_required / total_required
    return {
        "resolved": resolved_required,
        "total": total_required,
        "ratio": round(ratio, 4),
        "percent": round(ratio * 100),
    }


def required_days(hours_low: float, daily_capacity: float = DAILY_CAPACITY_HOURS) -> int:
    _require(daily_capacity > 0, "Daily capacity must be greater than 0")
    return math.ceil(hours_low / daily_capacity)


def project_timeline(
    hours_high: float,
    *,
    footage_preselected: bool = True,
    revision_rounds: int = 0,
    approver_count: int = 1,
    rush: bool = False,
    daily_capacity: float = DAILY_CAPACITY_HOURS,
) -> dict:
    """Deterministic delivery timeline derived from hours, asset readiness, review
    turnaround, and rush conditions. No fixed day counts. Every caller gets a named
    trace explaining each contribution so the UI can show its work."""
    _require(daily_capacity > 0, "Daily capacity must be greater than 0")
    _require(hours_high >= 0, "Hours must be non-negative")
    trace: list[dict] = []

    production_days = math.ceil(hours_high / daily_capacity) if hours_high > 0 else 0
    trace.append({
        "label": f"Production at {daily_capacity:g}h/day capacity",
        "days": production_days,
    })

    asset_days = 0
    if not footage_preselected:
        asset_days = 1
        trace.append({"label": "Asset readiness (footage not pre-selected)", "days": asset_days})

    review_days = 0
    rr = int(revision_rounds or 0)
    if rr > 0:
        per_round = 0.5 if rush else 1.0
        review_days = math.ceil(rr * per_round)
        ac = int(approver_count or 1)
        if ac >= 2:
            review_days += 1
        trace.append({
            "label": (
                f"Client review & approval ({rr} round(s), {ac} approver(s), "
                f"{'rush' if rush else 'standard'} turnaround)"
            ),
            "days": review_days,
        })

    total_days = production_days + asset_days + review_days
    trace.append({"label": "Total working days", "days": total_days})
    return {"total_days": total_days, "trace": trace, "daily_capacity": daily_capacity}


def risk_triggers(scope: dict, estimate: dict, price: dict) -> dict:
    """Explicit rule triggers only; no arbitrary score."""
    triggers: list[dict] = []

    budget = scope.get("client_budget")
    if budget is not None and budget < price["break_even_low"]:
        triggers.append({
            "code": "budget_below_break_even",
            "severity": "high",
            "label": "Budget below break-even",
            "detail": f"Client budget (IDR {budget:,.0f}) is below break-even (from IDR {price['break_even_low']:,.0f}).",
        })

    if scope.get("revision_rounds") is None:
        triggers.append({
            "code": "unlimited_revisions",
            "severity": "high",
            "label": "Unbounded revisions",
            "detail": "The brief mentions revisions without a clear limit or definition.",
        })

    if scope.get("deadline_working_days") is not None:
        need = required_days(estimate["low"])
        if scope["deadline_working_days"] < need:
            triggers.append({
                "code": "rush_deadline",
                "severity": "high",
                "label": "Deadline shorter than capacity",
                "detail": f"The low estimate needs about {need} working days, but the deadline is {scope['deadline_working_days']} days.",
            })

    unresolved = int(scope.get("unresolved_major_count") or 0)
    if unresolved >= 3:
        triggers.append({
            "code": "many_unresolved",
            "severity": "medium",
            "label": f"{unresolved} pricing variables unresolved",
            "detail": "Three or more key pricing variables are still unresolved.",
        })

    if not scope.get("footage_preselected", False) and scope.get("footage_available"):
        triggers.append({
            "code": "asset_dependency",
            "severity": "medium",
            "label": "Start depends on assets",
            "detail": "Footage is not selected yet; selection adds time and can move the start date.",
        })

    if int(scope.get("approver_count") or 1) >= 2:
        approvers = int(scope.get("approver_count") or 1)
        triggers.append({
            "code": "multiple_approvers",
            "severity": "medium",
            "label": f"{approvers} approvers",
            "detail": "Multiple approvers add communication time and revision risk.",
        })

    severities = {t["severity"] for t in triggers}
    if "high" in severities:
        level = "high"
    elif "medium" in severities:
        level = "medium"
    else:
        level = "low"
    return {"level": level, "triggers": triggers}


def confidence_level(scope_pct: int, has_history: bool, unresolved_major: int) -> dict:
    if scope_pct >= 85 and unresolved_major == 0 and has_history:
        level = "high"
        reason = "Critical fields are resolved and relevant history exists."
    elif scope_pct >= 60 and unresolved_major <= 2:
        level = "medium"
        reason = "Most fields are answered, but dependencies or history are still limited."
    else:
        level = "low"
        reason = "Important variables are still missing or there is no relevant history yet."
    return {"level": level, "reason": reason}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def round_to(value: float, step: int) -> int:
    return int(round(value / step) * step)
