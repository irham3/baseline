"""
Short-form video scope template, deterministic deal-option builder, PII redaction,
English copy templates, and the seeded demo fixture.

Numeric option parameters are ALWAYS produced here (application logic). Any LLM layer
may only verbalize these values, never change them.
"""
from __future__ import annotations

import re
from typing import Optional

import pricing

PROFESSION = "short_form_video"

# Required fields for scope-completeness accounting. Every field here is wired into
# hours, price, risk triggers, or timeline (see pricing.estimate_hours / risk_triggers /
# project_timeline). Fields the engine never uses for a number (e.g. feedback_method,
# source_file_handover) are intentionally excluded from P0 completeness -- they stay
# informational-only on the Brief Map instead of being asked as a high-priority gate.
REQUIRED_FIELDS = [
    "quantity",
    "final_duration",
    "aspect_ratio",
    "footage_available",
    "footage_preselected",
    "footage_hours",
    "scripting",
    "subtitles",
    "motion_level",
    "approver_count",
    "revision_rounds",
    "deadline_working_days",
    "client_budget",
]

RESOLVED_STATUSES = {"stated", "inferred"}


def compute_scope_completeness(overrides: dict) -> dict:
    """The single, consistent completeness calculation used by both the live estimate
    flow and the seeded demo. A required field counts as resolved only when it carries
    an actual (non-null, non-empty) value in the raw scope-override dict -- values that
    build_scope() fills in as defaults do not count, so silent assumptions are never
    presented as resolved facts. No hidden offsets or hardcoded counts."""
    resolved = sum(1 for name in REQUIRED_FIELDS if overrides.get(name) not in (None, ""))
    return pricing.scope_completeness(resolved, len(REQUIRED_FIELDS))


# --------------------------------------------------------------------------
# PII redaction (best-effort, not guaranteed complete -- see product copy)
# --------------------------------------------------------------------------
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Indonesian mobile numbers: +62/62/0 followed by 8xx and 7-12 more digits, allowing
# spaces/dashes as separators.
_PHONE_RE = re.compile(r"(?:\+62|62|0)8[\d\-\s]{7,13}\d")
_URL_RE = re.compile(r"\b(?:https?://|www\.)\S+", re.IGNORECASE)
# Social handles: @username (Instagram/Twitter/Telegram style). Applied after email
# redaction so an email's local part is never mistaken for a handle.
_HANDLE_RE = re.compile(r"(?<!\w)@[A-Za-z0-9_.]{2,30}\b")
# Long contiguous digit runs (10-16 digits) that look like a bank/account number.
# Shorter runs (phone numbers, budgets like "3000000") are left alone.
_BANK_ACCOUNT_RE = re.compile(r"(?<!\d)\d{10,16}(?!\d)")


def redact_pii(text: str) -> dict:
    emails = len(_EMAIL_RE.findall(text))
    redacted = _EMAIL_RE.sub("[email redacted]", text)

    phones = len(_PHONE_RE.findall(redacted))
    redacted = _PHONE_RE.sub("[phone redacted]", redacted)

    urls = len(_URL_RE.findall(redacted))
    redacted = _URL_RE.sub("[link redacted]", redacted)

    handles = len(_HANDLE_RE.findall(redacted))
    redacted = _HANDLE_RE.sub("[handle redacted]", redacted)

    accounts = len(_BANK_ACCOUNT_RE.findall(redacted))
    redacted = _BANK_ACCOUNT_RE.sub("[account number redacted]", redacted)

    total = emails + phones + urls + handles + accounts
    return {
        "text": redacted,
        "emails_found": emails,
        "phones_found": phones,
        "urls_found": urls,
        "handles_found": handles,
        "accounts_found": accounts,
        "total": total,
    }


# --------------------------------------------------------------------------
# Buffer derivation (named, explainable, scale-aware)
# --------------------------------------------------------------------------
# Each buffer is: a percentage of labor cost, floored at a minimum nominal amount, and
# capped so it never dominates the price floor on very large projects. Percentages,
# minimums, and caps are configurable operational assumptions, not universal constants.
def _pct_buffer(labor_cost: float, percent: float, minimum: int, cap: int, label: str) -> dict:
    amount = max(minimum, labor_cost * percent)
    amount = min(amount, cap)
    return {"label": f"{label} ({percent:.0%} of labor, min {format_idr(minimum)}, cap {format_idr(cap)})",
            "amount": round(amount)}


def derive_buffers(scope: dict, labor_cost: float = 0.0) -> list[dict]:
    buffers: list[dict] = []
    if scope.get("footage_available") and not scope.get("footage_preselected"):
        buffers.append(_pct_buffer(labor_cost, 0.08, 150_000, 750_000, "Footage dependency buffer"))
    if int(scope.get("approver_count") or 1) >= 2:
        buffers.append(_pct_buffer(labor_cost, 0.05, 100_000, 500_000, "Multi-approver buffer"))
    if scope.get("rush"):
        buffers.append(_pct_buffer(labor_cost, 0.15, 200_000, 1_000_000, "Rush contingency"))
    if not buffers:
        buffers.append(_pct_buffer(labor_cost, 0.05, 100_000, 400_000, "Base contingency"))
    return buffers


def _labor_cost_mid(est: dict, cost_per_hour: float) -> float:
    return (est["low"] + est["high"]) / 2 * cost_per_hour


def format_idr(amount: float) -> str:
    return "IDR " + f"{int(round(amount)):,}"


def format_idr_compact(amount: float) -> str:
    return f"IDR {amount / 1_000_000:.1f}M"


def plural(value: int, singular: str, plural_label: Optional[str] = None) -> str:
    return singular if int(value) == 1 else (plural_label or f"{singular}s")


def revision_phrase(rounds: int, consolidated: bool = False) -> str:
    prefix = "consolidated " if consolidated else ""
    return f"{rounds} {prefix}revision {plural(rounds, 'round')}"


# --------------------------------------------------------------------------
# Deal-option builder (deterministic)
# --------------------------------------------------------------------------
def _largest_viable_quantity(
    scope: dict, cost_per_hour: float, target_margin: float, client_budget: float
) -> tuple[Optional[int], Optional[dict], Optional[dict]]:
    """Option A helper: search for the largest quantity (down to 1) whose price floor
    fits the client budget. Returns (qty, estimate, price_info); (None, None, None) when
    even a single unit's price floor exceeds the budget -- no scope fits."""
    base = {**scope, "footage_preselected": True, "revision_rounds": 1, "motion_level": "none"}
    max_qty = int(scope.get("quantity") or 0)
    for qty in range(max_qty, 0, -1):
        trial = {**base, "quantity": qty}
        est = pricing.estimate_hours(trial)
        info = pricing.price_estimate(
            est["low"], est["high"], cost_per_hour, 0.0,
            derive_buffers(trial, _labor_cost_mid(est, cost_per_hour)), target_margin, client_budget,
        )
        if info["price_floor_high"] <= client_budget:
            return qty, est, info
    return None, None, None


def build_options(scope: dict, cost_per_hour: float, target_margin: float, client_budget: float) -> list[dict]:
    options: list[dict] = []

    # ---- Option A: keep budget, shrink scope (or report no viable scope) ----
    chosen_qty, a_est, a_price_info = _largest_viable_quantity(scope, cost_per_hour, target_margin, client_budget)
    if chosen_qty is None:
        # Even a single video's price floor exceeds the budget. Do not fabricate a
        # budget-fit option -- surface the gap and a recommended next step instead.
        floor_trial = {**scope, "quantity": 1, "footage_preselected": True,
                        "revision_rounds": 1, "motion_level": "none"}
        floor_est = pricing.estimate_hours(floor_trial)
        floor_info = pricing.price_estimate(
            floor_est["low"], floor_est["high"], cost_per_hour, 0.0,
            derive_buffers(floor_trial, _labor_cost_mid(floor_est, cost_per_hour)),
            target_margin, client_budget,
        )
        options.append({
            "id": "A",
            "type": "no_viable_scope",
            "title": "No viable scope at this budget",
            "price": None,
            "quantity": 0,
            "final_duration": scope.get("final_duration"),
            "timeline_days": None,
            "timeline_trace": None,
            "revision_rounds": 0,
            "footage_selection_included": False,
            "subtitles": True,
            "recommendation": "decline_or_revise_budget",
            "price_floor_low": floor_info["price_floor_low"],
            "price_floor_high": floor_info["price_floor_high"],
            "note": (
                f"Even a single video's price floor ({format_idr_compact(floor_info['price_floor_low'])} "
                f"to {format_idr_compact(floor_info['price_floor_high'])}) is above the "
                f"{format_idr_compact(client_budget)} budget. Recommend declining, asking for a revised "
                "budget, or clarifying scope further before quoting."
            ),
        })
    else:
        a_timeline = pricing.project_timeline(
            a_est["high"], footage_preselected=True, revision_rounds=1,
            approver_count=int(scope.get("approver_count") or 1), rush=False,
        )
        options.append({
            "id": "A",
            "type": "budget_fixed",
            "title": "Keep budget, reduce scope",
            "price": int(round(client_budget)),
            "quantity": chosen_qty,
            "final_duration": scope.get("final_duration"),
            "timeline_days": a_timeline["total_days"],
            "timeline_trace": a_timeline["trace"],
            "revision_rounds": 1,
            "footage_selection_included": False,
            "subtitles": True,
            "exclusions": ["Scripting", "Custom motion graphics", "Footage selection", "Additional formats"],
            "price_floor_low": a_price_info["price_floor_low"],
            "price_floor_high": a_price_info["price_floor_high"],
            "note": f"Keeps the client budget by reducing to {chosen_qty} {plural(chosen_qty, 'video')} and {revision_phrase(1)}.",
        })

    # ---- Option B: keep scope, normal timeline, defensible price ----
    b_scope = {**scope, "footage_preselected": False, "rush": False,
               "revision_rounds": scope.get("revision_rounds") or 2}
    b_est = pricing.estimate_hours(b_scope)
    b_info = pricing.price_estimate(
        b_est["low"], b_est["high"], cost_per_hour, 0.0,
        derive_buffers(b_scope, _labor_cost_mid(b_est, cost_per_hour)), target_margin, client_budget,
    )
    b_price = pricing.round_to((b_info["price_floor_low"] + b_info["price_floor_high"]) / 2, 250000)
    b_timeline = pricing.project_timeline(
        b_est["high"], footage_preselected=False, revision_rounds=b_scope["revision_rounds"],
        approver_count=int(scope.get("approver_count") or 1), rush=False,
    )
    options.append({
        "id": "B",
        "type": "scope_fixed_normal",
        "title": "Keep scope, normal timeline",
        "price": b_price,
        "quantity": int(scope.get("quantity") or 0),
        "final_duration": scope.get("final_duration"),
        "timeline_days": b_timeline["total_days"],
        "timeline_trace": b_timeline["trace"],
        "revision_rounds": b_scope["revision_rounds"],
        "footage_selection_included": True,
        "subtitles": True,
        "exclusions": ["Concept changes after storyboard approval", "Additional videos", "Additional aspect-ratio formats"],
        "price_floor_low": b_info["price_floor_low"],
        "price_floor_high": b_info["price_floor_high"],
        "note": f"Price sits inside the explainable floor range ({format_idr_compact(b_info['price_floor_low'])} to {format_idr_compact(b_info['price_floor_high'])}).",
    })

    # ---- Option C: keep scope, rush premium ----
    c_scope = {**b_scope, "rush": True, "revision_rounds": 1}
    c_est = pricing.estimate_hours(c_scope)
    c_info = pricing.price_estimate(
        c_est["low"], c_est["high"], cost_per_hour, 0.0,
        derive_buffers(c_scope, _labor_cost_mid(c_est, cost_per_hour)), target_margin, client_budget,
    )
    rush_price = pricing.round_to(c_info["price_floor_high"] * 1.13, 250000)
    rush_premium = rush_price - b_price
    c_timeline = pricing.project_timeline(
        c_est["high"], footage_preselected=False, revision_rounds=1,
        approver_count=int(scope.get("approver_count") or 1), rush=True,
    )
    options.append({
        "id": "C",
        "type": "scope_fixed_rush",
        "title": "Keep scope, rush premium",
        "price": rush_price,
        "quantity": int(scope.get("quantity") or 0),
        "final_duration": scope.get("final_duration"),
        "timeline_days": c_timeline["total_days"],
        "timeline_trace": c_timeline["trace"],
        "revision_rounds": 1,
        "footage_selection_included": True,
        "subtitles": True,
        "rush_premium": rush_premium,
        "conditions": ["Client feedback within 12 hours", "Complete assets before start", "Priority scheduling"],
        "exclusions": ["Additional revision rounds", "Concept changes after approval"],
        "price_floor_low": c_info["price_floor_low"],
        "price_floor_high": c_info["price_floor_high"],
        "note": f"Adds an {format_idr(rush_premium)} rush premium for compressed scheduling and faster approval.",
    })

    return options


# --------------------------------------------------------------------------
# English copy templates (deterministic; fully editable client-side)
# --------------------------------------------------------------------------
def _duration_phrase(opt: dict) -> str:
    d = opt.get("final_duration")
    return f"up to {int(round(float(d)))} seconds each" if d else "final duration to be confirmed"


def _deliverable_line(opt: dict) -> str:
    line = f"{opt['quantity']} vertical videos ({_duration_phrase(opt)})"
    if opt.get("subtitles"):
        line += ", subtitles"
    if opt.get("footage_selection_included"):
        line += ", footage selection included"
    return line


def whatsapp_message(scope: dict, options: list[dict], tone: str = "warm") -> str:
    a, b = options[0], options[1]
    opener = {
        "warm": "Thanks for the brief. I broke down the scope first.",
        "firm": "I reviewed the brief and need to protect the scope before quoting.",
        "formal": "Thank you for the brief. I have reviewed the scope and pricing assumptions.",
    }.get(tone, "Thanks for the brief.")

    if a.get("price") is None:
        # Option A is "no viable scope at this budget" -- do not describe a fabricated
        # safest option; be direct about the gap and point to what a full-scope quote
        # would actually cost instead.
        return (
            f"{opener} For {scope.get('quantity')} Reels, a few items still affect the quote: final duration, "
            f"footage selection, subtitles, approvers, and revision limits.\n\n"
            f"With an {format_idr(scope.get('client_budget'))} budget, I can't fit a viable scope right now -- "
            f"even a single video's price floor is above that budget. To move forward I'd need either a "
            f"revised budget or a different scope than what's described.\n\n"
            f"For reference, keeping all {b['quantity']} Reels with footage selection and {revision_phrase(b['revision_rounds'])} "
            f"would be {format_idr(b['price'])}, about {b['timeline_days']} working days after all assets are complete.\n\n"
            f"Let me know if either direction works, or if the budget can move."
        )

    return (
        f"{opener} For {scope.get('quantity')} Reels, a few items still affect the quote: final duration, "
        f"footage selection, subtitles, approvers, and revision limits.\n\n"
        f"With an {format_idr(scope.get('client_budget'))} budget, the safest option is "
        f"{_deliverable_line(a)} ({format_idr(a['price'])}, about {a['timeline_days']} working days "
        f"after all assets are complete). It includes {revision_phrase(a['revision_rounds'])}.\n\n"
        f"If you want to keep all {b['quantity']} Reels with footage selection and {revision_phrase(b['revision_rounds'])}, "
        f"the estimate is {format_idr(b['price'])}, about {b['timeline_days']} working days after all assets are complete.\n\n"
        f"I summarized the options in this link so we can choose the cleanest scope before production starts."
    )


def decline_message(scope: dict, tone: str = "warm") -> str:
    return (
        "Thanks for trusting me with this project. After reviewing the scope and timeline, "
        "I cannot take it on under the current terms while still protecting the quality of the work. "
        "If the timeline or scope becomes more flexible, I would be happy to revisit it."
    )


def clarification_whatsapp(questions: list[dict]) -> str:
    lines = ["Before I quote, can you help answer these scope questions?"]
    for i, q in enumerate(questions, 1):
        lines.append(f"{i}. {q['question']}")
    lines.append("\nThat keeps the offer accurate and prevents scope drift later. Thank you.")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Seeded demo fixture. Always works, no AI, computed by the real engine.
# --------------------------------------------------------------------------

SCOPE_SCHEMA = {
    "quantity": {"type": "number", "label": "Video count", "min": 1},
    "client_budget": {"type": "number", "label": "Client budget", "suffix": "IDR"},
    "final_duration": {"type": "number", "label": "Final duration / video", "suffix": "sec"},
    "deadline_working_days": {"type": "number", "label": "Deadline (working days)", "suffix": "days"},
    "approver_count": {"type": "number", "label": "Approver count", "suffix": "people", "min": 1},
    "revision_rounds": {
        "type": "select",
        "label": "Revision rounds",
        "options": [
            {"value": 1, "label": "1 round"},
            {"value": 2, "label": "2 rounds"},
            {"value": 3, "label": "3 rounds"},
            {"value": "unlimited", "label": "Unbounded"}
        ]
    },
    "footage_preselected": {"type": "boolean", "label": "Footage already selected"},
    "footage_hours": {
        "type": "number",
        "label": "Raw footage volume",
        "suffix": "hours",
        "hidden_if": {"footage_preselected": True}
    },
    "subtitles": {"type": "boolean", "label": "Subtitles included"},
    "scripting": {"type": "boolean", "label": "Scripting included"},
}

SEED_BRIEF = (
    "Hi, I need 12 Reels for next month's campaign. I will send the footage later. "
    "Budget is IDR 3M, ideally finished next week. Revisions until it feels right."
)
SEED_BRIEF_ID = (
    "Halo bro, mau minta tolong editin 12 Reels buat campaign bulan depan ya. Budget kita 3jt. "
    "Raw footage nyusul, minta tolong dibagusin sound design sama revisi sampai cocok ya."
)
SEED_BRIEFS = {SEED_BRIEF.strip(), SEED_BRIEF_ID.strip()}

SEED_COST_PROFILE = {
    "mode": "guided",
    "target_take_home": 8000000,
    "monthly_overhead": 1500000,
    "monthly_reserve": 900000,
    "total_working_hours": 160,
    "billable_utilization": 0.65,
    "target_margin": 0.20,
    "is_demo": True,
}


def _seed_fields() -> list[dict]:
    return [
        {"name": "quantity", "label": "Video count", "value": 12, "status": "stated",
         "source_quote": "12 Reels", "confidence": 0.99},
        {"name": "platform", "label": "Platform", "value": "Reels", "status": "stated",
         "source_quote": "12 Reels", "confidence": 0.95},
        {"name": "client_budget", "label": "Client budget", "value": 3000000, "status": "stated",
         "source_quote": "Budget is IDR 3M", "confidence": 0.98},
        {"name": "deadline", "label": "Deadline", "value": "next week (ambiguous)", "status": "stated",
         "source_quote": "finished next week", "confidence": 0.8},
        {"name": "footage_available", "label": "Footage", "value": "client will send it later", "status": "stated",
         "source_quote": "I will send the footage later", "confidence": 0.9},
        {"name": "revision_rounds", "label": "Revision rounds", "value": "unbounded", "status": "stated",
         "source_quote": "Revisions until it feels right", "confidence": 0.9,
         "inference_explanation": "\"Revisions until it feels right\" means revision exposure is not bounded."},
        {"name": "aspect_ratio", "label": "Aspect ratio", "value": "9:16", "status": "inferred",
         "source_quote": None, "confidence": 0.7,
         "inference_explanation": "Reels usually use a vertical 9:16 format."},
        {"name": "motion_level", "label": "Motion graphics", "value": "basic", "status": "inferred",
         "source_quote": None, "confidence": 0.5,
         "inference_explanation": "Not stated, so the estimate assumes basic motion."},
        {"name": "final_duration", "label": "Final duration", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "footage_preselected", "label": "Footage already selected?", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "footage_hours", "label": "Footage volume", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "scripting", "label": "Scripting", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "subtitles", "label": "Subtitles", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "approver_count", "label": "Approver count", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "feedback_method", "label": "Feedback method", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "source_file_handover", "label": "Source-file handover", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
    ]


def _seed_clarifications() -> list[dict]:
    return [
        {"id": "q1", "question": "What is the final duration for each video?",
         "why": "Final duration changes editing and subtitle time.",
         "impact": ["time", "cost"], "answer": "30-45 seconds per video"},
        {"id": "q2", "question": "Is the footage already selected, or should the editor review all raw footage?",
         "why": "Footage selection can add significant working hours.",
         "impact": ["time", "cost", "dependency"], "answer": "3 hours of raw footage, not selected"},
        {"id": "q3", "question": "Is scripting included? What about subtitles?",
         "why": "Scripting and subtitles change the work scope.",
         "impact": ["time", "acceptance"], "answer": "Scripting is excluded, subtitles are included"},
        {"id": "q4", "question": "How many people approve the work?",
         "why": "More approvers add communication time and revision risk.",
         "impact": ["time", "revision"], "answer": "2 approvers"},
        {"id": "q5", "question": "Are two consolidated revision rounds enough?",
         "why": "Revision limits define the largest time exposure.",
         "impact": ["revision", "cost"], "answer": "Yes, the client accepts 2 consolidated rounds"},
    ]


def resolved_seed_scope() -> dict:
    return {
        "quantity": 12,
        "final_duration": 45,
        "aspect_ratio": "9:16",
        "footage_available": True,
        "footage_preselected": False,
        "footage_hours": 3,
        "scripting": False,
        "subtitles": True,
        "audio_cleanup": True,
        "color_correction": True,
        "motion_level": "basic",
        "approver_count": 2,
        "revision_rounds": 2,
        "deadline_working_days": 5,
        "client_budget": 3000000,
        "unresolved_major_count": 2,
        "rush": False,
    }


# Bump when the public snapshot shape changes so old Agreement Sheets can be told apart
# from ones built under a newer contract.
AGREEMENT_SNAPSHOT_VERSION = "1.0.0"


def agreement_snapshot(opt: dict, project_title: str, client_name: Optional[str] = None, is_demo: bool = False) -> dict:
    """Build the client-facing immutable snapshot from a selected option. No internal cost data."""
    deliverables = [
        f"{opt.get('quantity')} vertical videos ({_duration_phrase(opt)}, 9:16)",
        "Subtitles" if opt.get("subtitles", True) else None,
        "Footage selection" if opt.get("footage_selection_included") else None,
        revision_phrase(opt.get("revision_rounds"), consolidated=True),
        "1 final 1080x1920 file per video",
    ]
    return {
        "project_title": project_title,
        "client_name": client_name,
        "is_demo": is_demo,
        "option_type": opt.get("type"),
        "option_title": opt.get("title"),
        "quantity": opt.get("quantity"),
        "price": opt.get("price"),
        "timeline_days": opt.get("timeline_days"),
        "revision_rounds": opt.get("revision_rounds"),
        "subtitles": opt.get("subtitles", True),
        "footage_selection_included": opt.get("footage_selection_included", False),
        "exclusions": opt.get("exclusions", []),
        "conditions": opt.get("conditions", []),
        "deliverables": [d for d in deliverables if d],
    }


def scope_change_message(classification: str, delta_result: Optional[dict] = None,
                         clarification: Optional[str] = None) -> str:
    if classification == "included":
        return ("Thanks. This request is still inside the approved scope, "
                "so I can handle it without an additional fee. I will continue.")
    if classification == "revision":
        return ("This fits as a revision within the agreed revision allowance. "
                "I will work from the consolidated feedback notes.")
    if classification == "new_scope":
        extra = ""
        if delta_result:
            extra = (f" It adds about "
                     f"{format_idr(delta_result['price_delta_low'])} to {format_idr(delta_result['price_delta_high'])} "
                     f"and {delta_result['hours_delta_low']:.0f}-{delta_result['hours_delta_high']:.0f} working hours.")
        return ("I can help with this, but it sits outside the approved scope "
                f"and changes the original baseline.{extra} I will send the adjustment first before continuing.")
    # unclear
    q = clarification or "Can you clarify the request a little more?"
    return f"To confirm whether this is inside the approved scope: {q}"


def compute_seed_analysis() -> dict:
    """Build the full seeded analysis using the real deterministic engine."""
    cp = SEED_COST_PROFILE
    cost_per_hour = pricing.productive_cost_per_hour(
        cp["target_take_home"], cp["monthly_overhead"], cp["monthly_reserve"],
        cp["total_working_hours"], cp["billable_utilization"],
    )
    scope = resolved_seed_scope()
    est = pricing.estimate_hours(scope)
    buffers = derive_buffers(scope)
    price = pricing.price_estimate(
        est["low"], est["high"], cost_per_hour, 0.0, buffers,
        cp["target_margin"], scope["client_budget"],
    )
    fields = _seed_fields()
    completeness = compute_scope_completeness(scope)
    risk = pricing.risk_triggers(scope, est, price)
    conf = pricing.confidence_level(completeness["percent"], has_history=False, unresolved_major=2)
    options = build_options(scope, cost_per_hour, cp["target_margin"], scope["client_budget"])
    whatsapp = {
        "warm": whatsapp_message(scope, options, "warm"),
        "firm": whatsapp_message(scope, options, "firm"),
        "formal": whatsapp_message(scope, options, "formal"),
    }
    return {
        "is_demo": True,
        "brief": SEED_BRIEF,
        "cost_profile": {**cp, "cost_per_hour": round(cost_per_hour)},
        "fields": fields,
        "clarifications": _seed_clarifications(),
        "estimate": est,
        "price": price,
        "scope_used": scope,
        "scope_completeness": completeness,
        "risk": risk,
        "confidence": conf,
        "options": options,
        "whatsapp": whatsapp,
        "decline_message": decline_message(scope),
        "formula_version": pricing.FORMULA_VERSION,
        "scope_schema": SCOPE_SCHEMA,
    }
