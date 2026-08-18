"""Baseline API — FastAPI + MongoDB. All routes under /api."""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient

import pricing
import scope as scope_mod
import ai_service
import auth as auth_mod

# --------------------------------------------------------------------------
# App / DB setup
# --------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Baseline API")
api = APIRouter(prefix="/api")

GOOGLE_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

COOKIE_KW = dict(httponly=True, secure=True, samesite="none", path="/")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def clean(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


# --------------------------------------------------------------------------
# Auth resolution
# --------------------------------------------------------------------------
async def _user_from_jwt(token: str) -> Optional[dict]:
    payload = auth_mod.decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    return user


async def _user_from_google(token: str) -> Optional[dict]:
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})


async def resolve_user(request: Request) -> Optional[dict]:
    access = request.cookies.get("access_token")
    session = request.cookies.get("session_token")
    bearer = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer = auth_header[7:]

    for tok in (access, bearer):
        if tok:
            u = await _user_from_jwt(tok)
            if u:
                return u
    for tok in (session, bearer):
        if tok:
            u = await _user_from_google(tok)
            if u:
                return u
    return None


async def require_user(request: Request) -> dict:
    u = await resolve_user(request)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return u


async def resolve_owner(request: Request) -> tuple[str, str]:
    u = await resolve_user(request)
    if u:
        return "user", u["user_id"]
    guest = request.headers.get("X-Guest-Id")
    if not guest:
        guest = f"guest_{uuid.uuid4().hex[:12]}"
    return "guest", guest


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionBody(BaseModel):
    session_id: str


class AnalyzeBody(BaseModel):
    brief: str
    redact: bool = False
    use_ai: bool = True


class CostProfileBody(BaseModel):
    mode: str = "guided"
    target_take_home: Optional[float] = None
    monthly_overhead: Optional[float] = None
    monthly_reserve: Optional[float] = None
    total_working_hours: Optional[float] = None
    billable_utilization: Optional[float] = None
    cost_per_hour: Optional[float] = None
    target_margin: float = 0.20
    save: bool = False


class EstimateBody(BaseModel):
    cost_profile: CostProfileBody
    scope_overrides: dict
    apply_calibration: bool = False


class AgreementBody(BaseModel):
    option: dict
    project_title: str
    client_name: Optional[str] = None


class AgreementResponseBody(BaseModel):
    action: str  # setuju | minta_perubahan | tanyakan_detail
    message: Optional[str] = None


class CalibrationBody(BaseModel):
    project_name: str
    estimated_hours: float
    actual_hours: float
    expected_revisions: int = 0
    actual_revisions: int = 0
    scope_note: Optional[str] = None
    deviation_reason: Optional[str] = None


class AnalyticsBody(BaseModel):
    event: str
    props: dict = {}


# --------------------------------------------------------------------------
# Analytics
# --------------------------------------------------------------------------
ALLOWED_EVENTS = {
    "demo_started", "brief_pasted", "brief_redacted", "analysis_completed",
    "field_corrected", "clarification_answered", "clarification_copied",
    "estimate_viewed", "formula_opened", "option_selected", "whatsapp_copied",
    "agreement_created", "agreement_viewed", "agreement_approved",
    "agreement_change_requested", "scope_check_completed", "project_actual_submitted",
}


@api.post("/analytics")
async def track(body: AnalyticsBody, request: Request):
    owner_type, owner_id = await resolve_owner(request)
    await db.analytics_events.insert_one({
        "event_id": uuid.uuid4().hex,
        "event": body.event,
        "props": body.props,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "created_at": iso(now_utc()),
    })
    return {"ok": True}


# --------------------------------------------------------------------------
# Health + demo seed
# --------------------------------------------------------------------------
@api.get("/health")
async def health():
    return {"status": "ok", "formula_version": pricing.FORMULA_VERSION}


@api.get("/demo/seed")
async def demo_seed():
    return scope_mod.compute_seed_analysis()


class DemoAgreementBody(BaseModel):
    option_id: str = "B"
    project_title: str = "Campaign 12 Reels — Baseline (demo)"


@api.post("/demo/agreement")
async def demo_agreement(body: DemoAgreementBody):
    """Create a real, shareable Lembar Sepakat from the seed fixture — no login, no AI."""
    seed = scope_mod.compute_seed_analysis()
    opt = next((o for o in seed["options"] if o["id"] == body.option_id), seed["options"][1])
    token = secrets.token_urlsafe(24)
    agreement = {
        "token": token,
        "analysis_id": None,
        "owner_type": "demo",
        "owner_id": "demo",
        "is_demo": True,
        "snapshot": {
            "project_title": body.project_title,
            "client_name": None,
            "is_demo": True,
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
            "deliverables": [
                f"{opt.get('quantity')} video vertikal (maks 45 detik, 9:16)",
                "Subtitle" if opt.get("subtitles", True) else None,
                "Pemilihan footage" if opt.get("footage_selection_included") else None,
                f"{opt.get('revision_rounds')} putaran revisi terkonsolidasi",
                "1 file final 1080x1920 per video",
            ],
        },
        "status": "SENT",
        "responses": [],
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=7)),
    }
    agreement["snapshot"]["deliverables"] = [d for d in agreement["snapshot"]["deliverables"] if d]
    await db.scope_agreements.insert_one(agreement)
    return {"token": token, "status": "SENT"}


@api.post("/redact")
async def redact(body: AnalyzeBody):
    return scope_mod.redact_pii(body.brief)


# --------------------------------------------------------------------------
# Auth: JWT email/password
# --------------------------------------------------------------------------
def _set_jwt_cookies(response: Response, user_id: str, email: str):
    response.set_cookie("access_token", auth_mod.create_access_token(user_id, email),
                        max_age=auth_mod.ACCESS_TOKEN_DAYS * 86400, **COOKIE_KW)
    response.set_cookie("refresh_token", auth_mod.create_refresh_token(user_id),
                        max_age=auth_mod.REFRESH_TOKEN_DAYS * 86400, **COOKIE_KW)


@api.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "password_hash": auth_mod.hash_password(body.password),
        "name": body.name or email.split("@")[0],
        "auth_provider": "password",
        "created_at": iso(now_utc()),
    })
    _set_jwt_cookies(response, user_id, email)
    return {"user_id": user_id, "email": email, "name": body.name or email.split("@")[0], "auth_provider": "password"}


@api.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not auth_mod.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    _set_jwt_cookies(response, user["user_id"], email)
    return clean(user)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    tok = request.cookies.get("refresh_token")
    payload = auth_mod.decode_token(tok) if tok else None
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    response.set_cookie("access_token", auth_mod.create_access_token(user["user_id"], user["email"]),
                        max_age=auth_mod.ACCESS_TOKEN_DAYS * 86400, **COOKIE_KW)
    return {"ok": True}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    session = request.cookies.get("session_token")
    if session:
        await db.user_sessions.delete_one({"session_token": session})
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(require_user)):
    return user


# --------------------------------------------------------------------------
# Auth: Emergent Google
# --------------------------------------------------------------------------
@api.post("/auth/google/session")
async def google_session(body: GoogleSessionBody, response: Response):
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(GOOGLE_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google session invalid")
    data = r.json()
    email = data["email"].lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
                                  {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "auth_provider": "google",
            "created_at": iso(now_utc()),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": iso(now_utc() + timedelta(days=7)),
        "created_at": iso(now_utc()),
    })
    response.set_cookie("session_token", session_token, max_age=7 * 86400, **COOKIE_KW)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return user


# --------------------------------------------------------------------------
# Cost profile
# --------------------------------------------------------------------------
def compute_cost_per_hour(cp: CostProfileBody) -> tuple[Optional[float], bool]:
    if cp.cost_per_hour and cp.cost_per_hour > 0:
        return float(cp.cost_per_hour), True
    fields = [cp.target_take_home, cp.monthly_overhead, cp.monthly_reserve,
              cp.total_working_hours, cp.billable_utilization]
    if any(v is None for v in fields):
        return None, False
    try:
        cph = pricing.productive_cost_per_hour(
            cp.target_take_home, cp.monthly_overhead, cp.monthly_reserve,
            cp.total_working_hours, cp.billable_utilization,
        )
        return cph, True
    except ValueError:
        return None, False


@api.post("/cost-profile")
async def save_cost_profile(body: CostProfileBody, request: Request):
    cph, complete = compute_cost_per_hour(body)
    owner_type, owner_id = await resolve_owner(request)
    doc = {
        "owner_type": owner_type,
        "owner_id": owner_id,
        **body.model_dump(),
        "cost_per_hour": round(cph) if cph else None,
        "complete": complete,
        "updated_at": iso(now_utc()),
    }
    if owner_type == "user":
        await db.cost_profiles.update_one({"owner_id": owner_id}, {"$set": doc}, upsert=True)
    return clean(doc)


@api.get("/cost-profile")
async def get_cost_profile(user: dict = Depends(require_user)):
    doc = await db.cost_profiles.find_one({"owner_id": user["user_id"]}, {"_id": 0})
    return doc or {}


# --------------------------------------------------------------------------
# Analyze
# --------------------------------------------------------------------------
@api.post("/analyze")
async def analyze(body: AnalyzeBody, request: Request):
    if len(body.brief.strip()) < 15:
        raise HTTPException(status_code=422, detail="Brief terlalu pendek untuk dianalisis (min. 15 karakter).")

    owner_type, owner_id = await resolve_owner(request)
    brief = body.brief
    redaction = None
    if body.redact:
        redaction = scope_mod.redact_pii(brief)
        brief = redaction["text"]

    try:
        extraction = await ai_service.extract_scope(brief)
    except RuntimeError as e:
        raise HTTPException(status_code=503,
                            detail=f"Analisis AI gagal ({e}). Coba lagi, atau gunakan contoh demo yang selalu tersedia.")

    analysis_id = uuid.uuid4().hex
    doc = {
        "analysis_id": analysis_id,
        "owner_type": owner_type,
        "owner_id": owner_id,
        "brief": brief,
        "is_demo": False,
        "redaction": redaction,
        "state": "NEEDS_CLARIFICATION",
        "fields": extraction["fields"],
        "ambiguities": extraction.get("ambiguities", []),
        "clarifications": extraction["clarifications"],
        "estimate": None,
        "price": None,
        "options": None,
        "formula_version": pricing.FORMULA_VERSION,
        "created_at": iso(now_utc()),
    }
    await db.brief_analyses.insert_one(doc)
    return clean(doc)


async def _owned_analysis(analysis_id: str, request: Request) -> dict:
    doc = await db.brief_analyses.find_one({"analysis_id": analysis_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Analisis tidak ditemukan")
    owner_type, owner_id = await resolve_owner(request)
    if doc["owner_id"] != owner_id:
        raise HTTPException(status_code=403, detail="Tidak diizinkan")
    return doc


@api.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str, request: Request):
    doc = await _owned_analysis(analysis_id, request)
    return clean(doc)


@api.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str, request: Request):
    await _owned_analysis(analysis_id, request)
    await db.brief_analyses.delete_one({"analysis_id": analysis_id})
    return {"ok": True}


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
        scope["footage_hours"] = 2  # assumption when unknown
    majors = ["final_duration", "footage_preselected", "footage_hours", "approver_count", "revision_rounds"]
    scope["unresolved_major_count"] = sum(1 for m in majors if ov.get(m) in (None, ""))
    return scope


@api.post("/analysis/{analysis_id}/estimate")
async def estimate(analysis_id: str, body: EstimateBody, request: Request):
    doc = await _owned_analysis(analysis_id, request)
    return await _run_estimate(doc, body, request, persist=True)


async def _run_estimate(doc: dict, body: EstimateBody, request: Request, persist: bool):
    scope = build_scope(body.scope_overrides)
    est = pricing.estimate_hours(scope)

    cph, complete = compute_cost_per_hour(body.cost_profile)
    target_margin = body.cost_profile.target_margin

    calibration_trace = None
    if body.apply_calibration:
        u = await resolve_user(request)
        if u:
            cal = await db.project_actuals.find_one({"owner_id": u["user_id"]}, {"_id": 0})
            if cal and cal.get("estimated_hours", 0) > 0:
                factor = cal["actual_hours"] / cal["estimated_hours"]
                extreme = factor > 2.5 or factor < 0.4
                est_cal_low = round(est["low"] * factor, 1)
                est_cal_high = round(est["high"] * factor, 1)
                calibration_trace = {
                    "project_name": cal["project_name"],
                    "estimated_hours": cal["estimated_hours"],
                    "actual_hours": cal["actual_hours"],
                    "factor": round(factor, 3),
                    "extreme": extreme,
                    "base_low": est["low"], "base_high": est["high"],
                    "adjusted_low": est_cal_low, "adjusted_high": est_cal_high,
                    "confidence": "low",
                    "note": "Sinyal kalibrasi satu proyek — bukan benchmark stabil.",
                }
                est = {"low": est_cal_low, "high": est_cal_high, "breakdown": est["breakdown"], "calibrated": True}

    completeness = pricing.scope_completeness(
        len(scope_mod.REQUIRED_FIELDS) - scope["unresolved_major_count"] - 2,
        len(scope_mod.REQUIRED_FIELDS),
    )

    price = None
    options = None
    whatsapp = None
    decline = None
    if complete and cph:
        buffers = scope_mod.derive_buffers(scope)
        price = pricing.price_estimate(
            est["low"], est["high"], cph, 0.0, buffers, target_margin,
            scope.get("client_budget"),
        )
        if scope.get("client_budget"):
            options = scope_mod.build_options(scope, cph, target_margin, scope["client_budget"])
            whatsapp = {
                "warm": scope_mod.whatsapp_message(scope, options, "warm"),
                "firm": scope_mod.whatsapp_message(scope, options, "firm"),
                "formal": scope_mod.whatsapp_message(scope, options, "formal"),
            }
            decline = scope_mod.decline_message(scope)

    risk = pricing.risk_triggers(scope, est, price or {"break_even_low": float("inf")})
    conf = pricing.confidence_level(completeness["percent"],
                                    has_history=calibration_trace is not None,
                                    unresolved_major=scope["unresolved_major_count"])

    result = {
        "estimate": est,
        "price": price,
        "price_available": price is not None,
        "cost_profile_complete": complete,
        "scope_completeness": completeness,
        "risk": risk,
        "confidence": conf,
        "options": options,
        "whatsapp": whatsapp,
        "decline_message": decline,
        "calibration_trace": calibration_trace,
        "scope_used": scope,
        "formula_version": pricing.FORMULA_VERSION,
    }

    if persist:
        await db.brief_analyses.update_one(
            {"analysis_id": doc["analysis_id"]},
            {"$set": {
                "state": "ESTIMATED" if price else "READY_TO_ESTIMATE",
                "estimate": est, "price": price, "options": options,
                "risk": risk, "confidence": conf, "scope_completeness": completeness,
                "whatsapp": whatsapp, "decline_message": decline,
                "cost_profile": {**body.cost_profile.model_dump(), "cost_per_hour": round(cph) if cph else None},
                "scope_used": scope, "calibration_trace": calibration_trace,
                "updated_at": iso(now_utc()),
            }},
        )
    return result


# --------------------------------------------------------------------------
# Agreement (Lembar Sepakat)
# --------------------------------------------------------------------------
@api.post("/analysis/{analysis_id}/agreement")
async def create_agreement(analysis_id: str, body: AgreementBody, request: Request):
    doc = await _owned_analysis(analysis_id, request)
    opt = body.option
    token = secrets.token_urlsafe(24)
    agreement = {
        "token": token,
        "analysis_id": analysis_id,
        "owner_type": doc["owner_type"],
        "owner_id": doc["owner_id"],
        "snapshot": {
            "project_title": body.project_title,
            "client_name": body.client_name,
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
            "deliverables": [
                f"{opt.get('quantity')} video vertikal (maks 45 detik, 9:16)",
                "Subtitle" if opt.get("subtitles", True) else None,
                "Pemilihan footage" if opt.get("footage_selection_included") else None,
                f"{opt.get('revision_rounds')} putaran revisi terkonsolidasi",
                "1 file final 1080x1920 per video",
            ],
        },
        "status": "SENT",
        "responses": [],
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=7)),
    }
    # remove None deliverables
    agreement["snapshot"]["deliverables"] = [d for d in agreement["snapshot"]["deliverables"] if d]
    await db.scope_agreements.insert_one(agreement)
    await db.brief_analyses.update_one({"analysis_id": analysis_id},
                                       {"$set": {"state": "SHARED", "shared_token": token}})
    return {"token": token, "status": "SENT"}


@api.get("/agreement/{token}")
async def get_agreement(token: str):
    doc = await db.scope_agreements.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Lembar Sepakat tidak ditemukan atau sudah dihapus.")
    expires_at = datetime.fromisoformat(doc["expires_at"])
    expired = expires_at < now_utc()
    # Public projection — never expose owner, analysis internals, cost, margin, break-even.
    return {
        "token": doc["token"],
        "status": "EXPIRED" if (expired and doc["status"] == "SENT") else doc["status"],
        "snapshot": doc["snapshot"],
        "responses": [{"action": r["action"], "created_at": r["created_at"]} for r in doc.get("responses", [])],
        "created_at": doc["created_at"],
        "expires_at": doc["expires_at"],
        "expired": expired,
    }


@api.post("/agreement/{token}/respond")
async def respond_agreement(token: str, body: AgreementResponseBody):
    doc = await db.scope_agreements.find_one({"token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Lembar Sepakat tidak ditemukan.")
    expires_at = datetime.fromisoformat(doc["expires_at"])
    if expires_at < now_utc():
        raise HTTPException(status_code=410, detail="Penawaran ini sudah kedaluwarsa.")
    action = body.action
    status_map = {"setuju": "APPROVED", "minta_perubahan": "CHANGE_REQUESTED", "tanyakan_detail": "SENT"}
    if action not in status_map:
        raise HTTPException(status_code=422, detail="Aksi tidak valid.")
    response = {"action": action, "message": body.message, "created_at": iso(now_utc())}
    await db.scope_agreements.update_one(
        {"token": token},
        {"$push": {"responses": response}, "$set": {"status": status_map[action]}},
    )
    return {"ok": True, "status": status_map[action]}


# --------------------------------------------------------------------------
# One-project calibration
# --------------------------------------------------------------------------
@api.post("/calibration")
async def save_calibration(body: CalibrationBody, user: dict = Depends(require_user)):
    if body.estimated_hours <= 0 or body.actual_hours <= 0:
        raise HTTPException(status_code=422, detail="Estimasi dan jam aktual harus lebih dari 0.")
    factor = body.actual_hours / body.estimated_hours
    doc = {
        "owner_id": user["user_id"],
        **body.model_dump(),
        "factor": round(factor, 3),
        "updated_at": iso(now_utc()),
    }
    await db.project_actuals.update_one({"owner_id": user["user_id"]}, {"$set": doc}, upsert=True)
    return clean(dict(doc))


@api.get("/calibration")
async def get_calibration(user: dict = Depends(require_user)):
    doc = await db.project_actuals.find_one({"owner_id": user["user_id"]}, {"_id": 0})
    return doc or {}


@api.delete("/calibration")
async def delete_calibration(user: dict = Depends(require_user)):
    await db.project_actuals.delete_one({"owner_id": user["user_id"]})
    return {"ok": True}


# --------------------------------------------------------------------------
# Wire up
# --------------------------------------------------------------------------
app.include_router(api)

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
_origins += ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.scope_agreements.create_index("token", unique=True)
    await db.brief_analyses.create_index("analysis_id", unique=True)
