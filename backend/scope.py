"""
Short-form video scope template, deterministic deal-option builder, PII redaction,
Indonesian copy templates, and the seeded demo fixture.

Numeric option parameters are ALWAYS produced here (application logic). Any LLM layer
may only verbalize these values, never change them.
"""
from __future__ import annotations

import re
from typing import Optional

import pricing

PROFESSION = "short_form_video"

# 15 required fields for scope-completeness accounting.
REQUIRED_FIELDS = [
    "quantity",
    "final_duration",
    "aspect_ratio",
    "footage_available",
    "footage_preselected",
    "footage_volume",
    "scripting",
    "subtitles",
    "motion_level",
    "approver_count",
    "revision_rounds",
    "deadline",
    "client_budget",
    "feedback_method",
    "source_file_handover",
]

RESOLVED_STATUSES = {"stated", "inferred"}


# --------------------------------------------------------------------------
# PII redaction
# --------------------------------------------------------------------------
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Indonesian mobile numbers: +62/62/0 followed by 8xx and 7-12 more digits, allowing
# spaces/dashes as separators.
_PHONE_RE = re.compile(r"(?:\+62|62|0)8[\d\-\s]{7,13}\d")


def redact_pii(text: str) -> dict:
    emails = len(_EMAIL_RE.findall(text))
    redacted = _EMAIL_RE.sub("[email disensor]", text)

    phones = len(_PHONE_RE.findall(redacted))
    redacted = _PHONE_RE.sub("[nomor disensor]", redacted)

    return {"text": redacted, "emails_found": emails, "phones_found": phones, "total": emails + phones}


# --------------------------------------------------------------------------
# Buffer derivation (named, explainable)
# --------------------------------------------------------------------------
def derive_buffers(scope: dict) -> list[dict]:
    buffers: list[dict] = []
    if scope.get("footage_available") and not scope.get("footage_preselected"):
        buffers.append({"label": "Footage dependency buffer", "amount": 250000})
    if int(scope.get("approver_count") or 1) >= 2:
        buffers.append({"label": "Multi-approver buffer", "amount": 150000})
    if scope.get("rush"):
        buffers.append({"label": "Rush contingency", "amount": 300000})
    if not buffers:
        buffers.append({"label": "Base contingency", "amount": 150000})
    return buffers


def format_idr(amount: float) -> str:
    return "Rp" + f"{int(round(amount)):,}".replace(",", ".")


def format_idr_juta(amount: float) -> str:
    return f"Rp{amount / 1_000_000:.1f} juta".replace(".", ",")


# --------------------------------------------------------------------------
# Deal-option builder (deterministic)
# --------------------------------------------------------------------------
def _fit_quantity_to_budget(scope: dict, cost_per_hour: float, target_margin: float, client_budget: float) -> tuple[int, dict]:
    """Option A helper: shrink quantity until the price floor fits the client budget."""
    base = {**scope, "footage_preselected": True, "revision_rounds": 1, "motion_level": "none"}
    chosen_qty, info = 1, None
    for qty in range(int(scope.get("quantity") or 0), 0, -1):
        trial = {**base, "quantity": qty}
        est = pricing.estimate_hours(trial)
        info = pricing.price_estimate(
            est["low"], est["high"], cost_per_hour, 0.0,
            derive_buffers(trial), target_margin, client_budget,
        )
        chosen_qty = qty
        if info["price_floor_high"] <= client_budget:
            break
    return chosen_qty, info


def build_options(scope: dict, cost_per_hour: float, target_margin: float, client_budget: float) -> list[dict]:
    options: list[dict] = []

    # ---- Option A: keep budget, shrink scope ----
    chosen_qty, a_price_info = _fit_quantity_to_budget(scope, cost_per_hour, target_margin, client_budget)
    options.append({
        "id": "A",
        "type": "budget_fixed",
        "title": "Budget tetap, scope dikurangi",
        "price": int(round(client_budget)),
        "quantity": chosen_qty,
        "timeline_days": 10,
        "revision_rounds": 1,
        "footage_selection_included": False,
        "subtitles": True,
        "exclusions": ["Scripting", "Motion graphics kustom", "Pemilihan footage", "Format tambahan"],
        "price_floor_low": a_price_info["price_floor_low"],
        "price_floor_high": a_price_info["price_floor_high"],
        "note": f"Harga dijaga di budget klien dengan {chosen_qty} video dan 1 putaran revisi.",
    })

    # ---- Option B: keep scope, normal timeline, defensible price ----
    b_scope = {**scope, "footage_preselected": False, "rush": False,
               "revision_rounds": scope.get("revision_rounds") or 2}
    b_est = pricing.estimate_hours(b_scope)
    b_info = pricing.price_estimate(
        b_est["low"], b_est["high"], cost_per_hour, 0.0,
        derive_buffers(b_scope), target_margin, client_budget,
    )
    b_price = pricing.round_to((b_info["price_floor_low"] + b_info["price_floor_high"]) / 2, 250000)
    options.append({
        "id": "B",
        "type": "scope_fixed_normal",
        "title": "Scope tetap, timeline normal",
        "price": b_price,
        "quantity": int(scope.get("quantity") or 0),
        "timeline_days": 21,
        "revision_rounds": b_scope["revision_rounds"],
        "footage_selection_included": True,
        "subtitles": True,
        "exclusions": ["Perubahan konsep setelah storyboard disetujui", "Video tambahan", "Format aspect ratio tambahan"],
        "price_floor_low": b_info["price_floor_low"],
        "price_floor_high": b_info["price_floor_high"],
        "note": f"Harga di dalam rentang price floor ({format_idr_juta(b_info['price_floor_low'])}–{format_idr_juta(b_info['price_floor_high'])}).",
    })

    # ---- Option C: keep scope, rush premium ----
    c_scope = {**b_scope, "rush": True, "revision_rounds": 1}
    c_est = pricing.estimate_hours(c_scope)
    c_info = pricing.price_estimate(
        c_est["low"], c_est["high"], cost_per_hour, 0.0,
        derive_buffers(c_scope), target_margin, client_budget,
    )
    rush_price = pricing.round_to(c_info["price_floor_high"] * 1.13, 250000)
    rush_premium = rush_price - b_price
    options.append({
        "id": "C",
        "type": "scope_fixed_rush",
        "title": "Scope tetap, rush premium",
        "price": rush_price,
        "quantity": int(scope.get("quantity") or 0),
        "timeline_days": 7,
        "revision_rounds": 1,
        "footage_selection_included": True,
        "subtitles": True,
        "rush_premium": rush_premium,
        "conditions": ["Feedback klien maksimal 12 jam", "Aset lengkap sebelum mulai", "Priority scheduling"],
        "exclusions": ["Putaran revisi tambahan", "Perubahan konsep setelah approval"],
        "price_floor_low": c_info["price_floor_low"],
        "price_floor_high": c_info["price_floor_high"],
        "note": f"Rush premium {format_idr(rush_premium)} karena timeline dipadatkan dan approval dipercepat.",
    })

    return options


# --------------------------------------------------------------------------
# Indonesian copy templates (deterministic; fully editable client-side)
# --------------------------------------------------------------------------
def _deliverable_line(opt: dict) -> str:
    line = f"{opt['quantity']} video vertikal (maks 45 detik)"
    if opt.get("subtitles"):
        line += ", subtitle"
    if opt.get("footage_selection_included"):
        line += ", termasuk pemilihan footage"
    return line


def whatsapp_message(scope: dict, options: list[dict], tone: str = "warm") -> str:
    a, b = options[0], options[1]
    opener = {
        "warm": "Siap, Kak! Terima kasih briefnya.",
        "firm": "Halo, Kak. Sudah saya breakdown briefnya.",
        "formal": "Selamat siang. Terima kasih atas briefnya.",
    }.get(tone, "Siap, Kak!")

    return (
        f"{opener} Setelah saya breakdown, untuk {scope.get('quantity')} Reels ada beberapa hal "
        f"yang perlu dipastikan dulu: durasi final, pemilihan footage, subtitle, jumlah approver, "
        f"dan batas revisi.\n\n"
        f"Dengan budget {format_idr(scope.get('client_budget'))}, opsi paling aman adalah "
        f"{_deliverable_line(a)} dengan {a['revision_rounds']} putaran revisi "
        f"({format_idr(a['price'])}, ± {a['timeline_days']} hari kerja setelah aset lengkap).\n\n"
        f"Kalau tetap {b['quantity']} Reels termasuk pemilihan footage dan {b['revision_rounds']} putaran revisi, "
        f"estimasinya {format_idr(b['price'])} dengan waktu ± 3 minggu setelah semua aset lengkap.\n\n"
        f"Saya rangkum pilihannya di link ini supaya kita gampang pilih yang paling cocok ya, Kak. 🙏"
    )


def decline_message(scope: dict, tone: str = "warm") -> str:
    return (
        "Halo, Kak. Terima kasih banyak sudah mempercayakan project ini. "
        "Setelah saya cek detailnya, untuk saat ini saya belum bisa ambil dengan scope dan timeline tersebut "
        "supaya hasilnya tetap maksimal. Kalau nanti timeline atau scope-nya lebih fleksibel, "
        "dengan senang hati saya bantu. Semoga project-nya lancar ya, Kak. 🙏"
    )


def clarification_whatsapp(questions: list[dict]) -> str:
    lines = ["Halo, Kak! Sebelum saya kasih penawaran, boleh dibantu jawab beberapa hal ini ya:"]
    for i, q in enumerate(questions, 1):
        lines.append(f"{i}. {q['question']}")
    lines.append("\nBiar penawarannya pas dan nggak ada yang meleset. Makasih, Kak! 🙏")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Seeded demo fixture — always works, no AI, computed by the real engine.
# --------------------------------------------------------------------------
SEED_BRIEF = (
    "Kak mau edit 12 reels buat campaign bulan depan. Footage nanti aku kirim. "
    "Budget 3 juta ya, kalau bisa minggu depan selesai. Revisi sampai cocok."
)

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
        {"name": "quantity", "label": "Jumlah video", "value": 12, "status": "stated",
         "source_quote": "12 reels", "confidence": 0.99},
        {"name": "platform", "label": "Platform", "value": "Reels", "status": "stated",
         "source_quote": "12 reels", "confidence": 0.95},
        {"name": "client_budget", "label": "Budget klien", "value": 3000000, "status": "stated",
         "source_quote": "Budget 3 juta", "confidence": 0.98},
        {"name": "deadline", "label": "Deadline", "value": "minggu depan (ambigu)", "status": "stated",
         "source_quote": "minggu depan selesai", "confidence": 0.8},
        {"name": "footage_available", "label": "Footage", "value": "klien mengirim", "status": "stated",
         "source_quote": "Footage nanti aku kirim", "confidence": 0.9},
        {"name": "revision_rounds", "label": "Putaran revisi", "value": "tidak dibatasi", "status": "stated",
         "source_quote": "Revisi sampai cocok", "confidence": 0.9,
         "inference_explanation": "\u201cRevisi sampai cocok\u201d menandakan revisi tidak dibatasi."},
        {"name": "aspect_ratio", "label": "Aspect ratio", "value": "9:16", "status": "inferred",
         "source_quote": None, "confidence": 0.7,
         "inference_explanation": "Reels umumnya 9:16 vertikal."},
        {"name": "motion_level", "label": "Motion graphics", "value": "basic", "status": "inferred",
         "source_quote": None, "confidence": 0.5,
         "inference_explanation": "Tidak disebut, diasumsikan basic."},
        {"name": "final_duration", "label": "Durasi final", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "footage_preselected", "label": "Footage sudah dipilih?", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "footage_volume", "label": "Volume footage", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "scripting", "label": "Scripting", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "subtitles", "label": "Subtitle", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "approver_count", "label": "Jumlah approver", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "feedback_method", "label": "Metode feedback", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
        {"name": "source_file_handover", "label": "Serah terima source file", "value": None, "status": "missing",
         "source_quote": None, "confidence": 1.0},
    ]


def _seed_clarifications() -> list[dict]:
    return [
        {"id": "q1", "question": "Berapa durasi final setiap video?",
         "why": "Durasi final memengaruhi waktu editing dan subtitle.",
         "impact": ["time", "cost"], "answer": "30\u201345 detik per video"},
        {"id": "q2", "question": "Apakah footage sudah dipilih, atau editor harus memilah semua footage?",
         "why": "Pemilihan footage bisa menambah jam kerja yang signifikan.",
         "impact": ["time", "cost", "dependency"], "answer": "3 jam footage, belum dipilih"},
        {"id": "q3", "question": "Apakah scripting termasuk? Bagaimana dengan subtitle?",
         "why": "Scripting dan subtitle menambah scope pekerjaan.",
         "impact": ["time", "acceptance"], "answer": "Scripting tidak termasuk, subtitle termasuk"},
        {"id": "q4", "question": "Berapa orang yang memberi approval?",
         "why": "Banyak approver menambah komunikasi dan revisi.",
         "impact": ["time", "revision"], "answer": "2 orang"},
        {"id": "q5", "question": "Apakah dua putaran revisi terkonsolidasi cukup?",
         "why": "Batas revisi menentukan exposure waktu terbesar.",
         "impact": ["revision", "cost"], "answer": "Ya, klien setuju 2 putaran terkonsolidasi"},
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
    resolved = 13  # 11 stated/inferred + duration + footage/approver/revision answered via clarification
    completeness = pricing.scope_completeness(resolved, len(REQUIRED_FIELDS))
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
        "scope_completeness": completeness,
        "risk": risk,
        "confidence": conf,
        "options": options,
        "whatsapp": whatsapp,
        "decline_message": decline_message(scope),
        "formula_version": pricing.FORMULA_VERSION,
    }
