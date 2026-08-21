"""Analysis routes: analyze, estimate, deal-copy, scope-check, redact, demo seed."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, HTTPException, Depends

import pricing
import scope as scope_mod
import ai_service
import rules
import core
from core import db, now_utc, iso, clean, resolve_user, resolve_owner
from models import AnalyzeBody, CostProfileBody, EstimateBody, DealCopyBody, ScopeCheckBody
from rate_limit import rate_limit

router = APIRouter(prefix="/api")


# -------- demo + redact --------
@router.get("/demo/seed")
async def demo_seed():
    return scope_mod.compute_seed_analysis()


@router.post("/redact")
async def redact(body: AnalyzeBody):
    return scope_mod.redact_pii(body.brief)


# -------- cost profile helper --------
def compute_cost_per_hour(cp: CostProfileBody):
    if cp.cost_per_hour and cp.cost_per_hour > 0:
        return float(cp.cost_per_hour), True
    fields = [cp.target_take_home, cp.monthly_overhead, cp.monthly_reserve,
              cp.total_working_hours, cp.billable_utilization]
    if any(v is None for v in fields):
        return None, False
    try:
        return pricing.productive_cost_per_hour(
            cp.target_take_home, cp.monthly_overhead, cp.monthly_reserve,
            cp.total_working_hours, cp.billable_utilization,
        ), True
    except ValueError:
        return None, False


def build_scope(ov: dict) -> dict:
    scope = {
        "quantity": ov.get("quantity"),
        "final_duration": ov.get("final_duration"),
        "aspect_ratio": ov.get("aspect_ratio", "9:16"),
        "footage_available": ov.get("footage_available", True),
        "footage_preselected": ov.get("footage_preselected"),
        "footage_hours": ov.get("footage_hours"),
        "scripting": ov.get("scripting", False),
        "subtitles": ov.get("subtitles", True),
        "audio_cleanup": ov.get("audio_cleanup", True),
        "color_correction": ov.get("color_correction", True),
        "motion_level": ov.get("motion_level", "basic"),
        "approver_count": ov.get("approver_count") or 1,
        "revision_rounds": ov.get("revision_rounds"),
        "deadline_working_days": ov.get("deadline_working_days"),
        "client_budget": ov.get("client_budget"),
        "rush": ov.get("rush", False),
    }
    if not scope["footage_preselected"] and scope["footage_available"] and not scope["footage_hours"]:
        scope["footage_hours"] = 2
    majors = ["final_duration", "footage_preselected", "footage_hours", "approver_count", "revision_rounds"]
    scope["unresolved_major_count"] = sum(1 for m in majors if ov.get(m) in (None, ""))
    return scope


# -------- analyze --------
@router.post("/analyze", dependencies=[Depends(rate_limit("analyze", 10, 60))])
async def analyze(body: AnalyzeBody, request: Request):
    if len(body.brief.strip()) < 15:
        raise HTTPException(status_code=422, detail="Brief is too short to analyze (minimum 15 characters).")
    owner_type, owner_id = await resolve_owner(request)
    brief = body.brief
    redaction = None
    if body.redact:
        redaction = scope_mod.redact_pii(brief)
        brief = redaction["text"]

    # The seeded demo is keyed by matching the exact seed brief text, not by the
    # use_ai flag -- use_ai=False means "analyze my real text deterministically",
    # not "show the canned demo regardless of what I typed".
    is_seed_demo = brief.strip() in getattr(scope_mod, "SEED_BRIEFS", {scope_mod.SEED_BRIEF})

    seed = None
    if is_seed_demo:
        seed = scope_mod.compute_seed_analysis()
        extraction = {
            "fields": seed["fields"],
            "ambiguities": [],
            "clarifications": seed["clarifications"],
            "provenance": "seed",
        }
    elif not body.use_ai:
        extraction = ai_service.extract_scope_heuristic(brief)
    else:
        try:
            extraction = await ai_service.extract_scope(brief)
        except RuntimeError as e:
            raise HTTPException(status_code=503,
                                detail=f"AI analysis failed ({e}). Try again or use the always-available demo sample.")
    classification = rules.classify_profession(brief)
    deal_issues = rules.run_generic_deal_rules(extraction["fields"], extraction.get("ambiguities", []))
    readiness_state = rules.compute_readiness_state(deal_issues, classification["support_level"])

    analysis_id = uuid.uuid4().hex
    doc = {
        "analysis_id": analysis_id, "owner_type": owner_type, "owner_id": owner_id,
        "brief": brief, "is_demo": is_seed_demo, "redaction": redaction,
        "provenance": extraction.get("provenance", "heuristic_fallback"),
        "state": "COMPLETED" if seed else "NEEDS_CLARIFICATION",
        "profession": classification["profession"], "support_level": classification["support_level"],
        "deal_issues": deal_issues, "readiness_state": readiness_state,
        "rule_version": rules.RULE_VERSION,
        "fields": extraction["fields"],
        "ambiguities": extraction.get("ambiguities", []),
        "clarifications": extraction["clarifications"],
        "estimate": seed["estimate"] if seed else None,
        "price": seed["price"] if seed else None,
        "options": seed["options"] if seed else None,
        "formula_version": pricing.FORMULA_VERSION, "created_at": iso(now_utc()),
    }
    if seed:
        doc["scope_used"] = seed["scope_used"]
        doc["risk"] = seed["risk"]
        doc["confidence"] = seed["confidence"]
        doc["scope_completeness"] = seed["scope_completeness"]
        doc["whatsapp"] = seed["whatsapp"]
        doc["decline_message"] = seed["decline_message"]
        doc["calibration_trace"] = None
    await db.brief_analyses.insert_one(doc)
    return clean(doc)


async def _owned_analysis(analysis_id: str, request: Request) -> dict:
    doc = await db.brief_analyses.find_one({"analysis_id": analysis_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    _, owner_id = await resolve_owner(request)
    if doc["owner_id"] != owner_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return doc


@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, request: Request):
    return clean(await _owned_analysis(analysis_id, request))


@router.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str, request: Request):
    await _owned_analysis(analysis_id, request)
    await db.brief_analyses.delete_one({"analysis_id": analysis_id})
    return {"ok": True}


# -------- estimate --------
def _apply_calibration(est: dict, summary: dict) -> tuple[dict, dict]:
    factor = summary["median_factor"]
    primary = summary["projects"][0] if summary.get("projects") else {}
    adj_low = round(est["low"] * factor, 1)
    adj_high = round(est["high"] * factor, 1)
    trace = {
        "factor": factor, "median_factor": factor, "count": summary["count"], "confidence": summary["confidence"],
        "project_name": primary.get("project_name", "Personal Estimation Memory"),
        "estimated_hours": primary.get("estimated_hours"),
        "actual_hours": primary.get("actual_hours"),
        "projects": summary["projects"], "extreme": factor > 2.5 or factor < 0.4,
        "base_low": est["low"], "base_high": est["high"],
        "adjusted_low": adj_low, "adjusted_high": adj_high,
        "note": "Calibration signal from your project history, not a machine-learning model.",
    }
    return {"low": adj_low, "high": adj_high, "breakdown": est["breakdown"], "calibrated": True}, trace


def _build_pricing(scope: dict, cph: float, target_margin: float, est: dict) -> dict:
    out = {"price": None, "options": None, "whatsapp": None, "decline": None}
    labor_mid = (est["low"] + est["high"]) / 2 * cph
    buffers = scope_mod.derive_buffers(scope, labor_mid)
    out["price"] = pricing.price_estimate(est["low"], est["high"], cph, 0.0, buffers,
                                          target_margin, scope.get("client_budget"))
    if scope.get("client_budget"):
        options = scope_mod.build_options(scope, cph, target_margin, scope["client_budget"])
        out["options"] = options
        out["whatsapp"] = {t: scope_mod.whatsapp_message(scope, options, t) for t in ("warm", "firm", "formal")}
        out["decline"] = scope_mod.decline_message(scope)
    return out


def _overrides_to_fields(overrides: dict) -> list[dict]:
    """Re-express user-resolved overrides as evidence-shaped fields so the same
    Generic Deal Rule Pack can re-check readiness after clarification answers,
    instead of re-checking the original (now stale) AI extraction."""
    names = ("quantity", "revision_rounds", "final_duration", "footage_available",
             "footage_preselected", "deadline_working_days", "approver_count", "client_budget")
    fields = []
    for name in names:
        value = overrides.get(name)
        fields.append({
            "name": name, "value": value,
            "status": "missing" if value in (None, "") else "stated",
            "source_quote": None,
        })
    return fields


@router.post("/analysis/{analysis_id}/estimate")
async def estimate(analysis_id: str, body: EstimateBody, request: Request):
    doc = await _owned_analysis(analysis_id, request)
    scope = build_scope(body.scope_overrides)
    est = pricing.estimate_hours(scope)
    deal_issues = rules.run_generic_deal_rules(_overrides_to_fields(body.scope_overrides), [])
    readiness_state = rules.compute_readiness_state(deal_issues, doc.get("support_level", "calibrated_estimation"))
    cph, complete = compute_cost_per_hour(body.cost_profile)
    target_margin = body.cost_profile.target_margin

    calibration_trace = None
    if body.apply_calibration:
        u = await resolve_user(request)
        if u:
            summary = await core.calibration_summary(u["user_id"])
            if summary:
                est, calibration_trace = _apply_calibration(est, summary)

    completeness = scope_mod.compute_scope_completeness(body.scope_overrides)
    # Principle #4 (master plan 1.3): an unsupported profession never gets a fabricated
    # EstimateScenario, no matter how complete its scope looks -- only readiness_state
    # "ready_to_estimate" (support_level == calibrated_estimation, no open high-severity
    # issues) is allowed to price. "ready_scope_only" still returns hours/price as None.
    can_price = complete and cph and readiness_state == "ready_to_estimate"
    parts = _build_pricing(scope, cph, target_margin, est) if can_price else \
        {"price": None, "options": None, "whatsapp": None, "decline": None}
    price, options = parts["price"], parts["options"]

    risk_scope = scope if price else {**scope, "client_budget": None}
    risk = pricing.risk_triggers(risk_scope, est, price or {"break_even_low": float("inf")})
    conf = pricing.confidence_level(completeness["percent"], has_history=calibration_trace is not None,
                                    unresolved_major=scope["unresolved_major_count"])
    result = {
        "estimate": est, "price": price, "price_available": price is not None,
        "cost_profile_complete": complete, "scope_completeness": completeness,
        "risk": risk, "confidence": conf, "options": options,
        "whatsapp": parts["whatsapp"], "decline_message": parts["decline"],
        "calibration_trace": calibration_trace, "scope_used": scope,
        "deal_issues": deal_issues, "readiness_state": readiness_state,
        "formula_version": pricing.FORMULA_VERSION,
    }
    await db.brief_analyses.update_one(
        {"analysis_id": doc["analysis_id"]},
        {"$set": {
            "state": "ESTIMATED" if price else "READY_TO_ESTIMATE",
            "deal_issues": deal_issues, "readiness_state": readiness_state,
            "estimate": est, "price": price, "options": options, "risk": risk,
            "confidence": conf, "scope_completeness": completeness,
            "whatsapp": parts["whatsapp"], "decline_message": parts["decline"],
            "cost_profile": {**body.cost_profile.model_dump(), "cost_per_hour": round(cph) if cph else None},
            "scope_used": scope, "calibration_trace": calibration_trace, "updated_at": iso(now_utc()),
        }},
    )
    return result


# -------- AI deal copy (polished English; numbers stay fixed) --------
@router.post("/analysis/{analysis_id}/deal-copy")
async def deal_copy(analysis_id: str, body: DealCopyBody, request: Request):
    await _owned_analysis(analysis_id, request)
    scope = build_scope(body.scope_overrides)
    opts = body.options
    if len(opts) < 2:
        raise HTTPException(status_code=422, detail="At least two options are required for deal copy.")
    a, b = opts[0], opts[1]
    if a.get("price") is None or b.get("price") is None:
        raise HTTPException(status_code=422, detail="Both options must have a price to draft deal copy.")
    price_tokens = [scope_mod.format_idr(a["price"]), scope_mod.format_idr(b["price"])]
    params = {
        "quantity": scope.get("quantity"),
        "client_budget": scope_mod.format_idr(scope.get("client_budget")),
        "option_a": {"price": scope_mod.format_idr(a["price"]), "videos": a["quantity"],
                     "revisions": a["revision_rounds"], "timeline_days": a["timeline_days"]},
        "option_b": {"price": scope_mod.format_idr(b["price"]), "videos": b["quantity"],
                     "revisions": b["revision_rounds"], "timeline_days": b["timeline_days"],
                     "includes_footage_selection": b.get("footage_selection_included", True)},
    }
    try:
        drafts = await ai_service.polish_whatsapp(params, price_tokens)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"AI deal copy failed ({e}). Template drafts are still available.")
    return {"whatsapp": drafts, "source": "ai"}


# -------- Scope Check (P0.5) --------
@router.post("/analysis/{analysis_id}/scope-check", dependencies=[Depends(rate_limit("scope-check", 10, 60))])
async def scope_check(analysis_id: str, body: ScopeCheckBody, request: Request):
    doc = await _owned_analysis(analysis_id, request)
    agreement = await db.scope_agreements.find_one({"analysis_id": analysis_id}, {"_id": 0},
                                                   sort=[("created_at", -1)])
    if not agreement:
        raise HTTPException(status_code=400, detail="Create an Agreement Sheet before running Scope Check.")
    baseline = agreement["snapshot"]

    try:
        classified = await ai_service.classify_scope_change(baseline, body.new_request)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"Scope Check AI failed ({e}). Try again.")

    delta_result = None
    if classified["classification"] == "new_scope" and body.delta and body.cost_profile:
        cph, complete = compute_cost_per_hour(body.cost_profile)
        base_scope = doc.get("scope_used")
        if complete and cph and base_scope:
            delta = body.delta
            new_scope = dict(base_scope)
            new_scope["quantity"] = (base_scope.get("quantity") or 0) + int(delta.get("added_videos") or 0)
            if delta.get("add_motion"):
                new_scope["motion_level"] = "custom"
            base_rr = base_scope.get("revision_rounds") or 0
            new_scope["revision_rounds"] = base_rr + int(delta.get("added_revisions") or 0)
            tm = body.cost_profile.target_margin
            est_base = pricing.estimate_hours(base_scope)
            est_new = pricing.estimate_hours(new_scope)
            base_buffers = scope_mod.derive_buffers(base_scope, (est_base["low"] + est_base["high"]) / 2 * cph)
            new_buffers = scope_mod.derive_buffers(new_scope, (est_new["low"] + est_new["high"]) / 2 * cph)
            p_base = pricing.price_estimate(est_base["low"], est_base["high"], cph, 0.0, base_buffers, tm)
            p_new = pricing.price_estimate(est_new["low"], est_new["high"], cph, 0.0, new_buffers, tm)
            delta_result = {
                "hours_delta_low": round(est_new["low"] - est_base["low"], 1),
                "hours_delta_high": round(est_new["high"] - est_base["high"], 1),
                "price_delta_low": max(0, p_new["price_floor_low"] - p_base["price_floor_low"]),
                "price_delta_high": max(0, p_new["price_floor_high"] - p_base["price_floor_high"]),
                "new_quantity": new_scope["quantity"],
            }

    whatsapp = scope_mod.scope_change_message(
        classified["classification"], delta_result, classified.get("clarification_question"))

    await db.brief_analyses.update_one({"analysis_id": analysis_id},
                                       {"$set": {"last_scope_check_at": iso(now_utc())}})
    return {**classified, "delta_result": delta_result, "whatsapp": whatsapp}
