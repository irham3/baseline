"""Baseline API entrypoint: assembles routers, CORS, health, analytics, startup."""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import uuid

from fastapi import FastAPI, APIRouter, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import ai_service
import pricing
from core import db, now_utc, iso, resolve_owner, ENVIRONMENT, IS_PRODUCTION, MONGO_URL
from models import AnalyticsBody
from routers import auth, analysis, agreement, account

app = FastAPI(title="Baseline API")


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    # Deterministic pricing/scope validation (pricing._require and friends) raises
    # plain ValueError for invalid input. Surface it as a controlled 4xx instead of an
    # unhandled 500.
    return JSONResponse(status_code=422, content={"detail": str(exc)})


misc = APIRouter(prefix="/api")

ALLOWED_ANALYTICS_EVENTS = {
    "estimate_viewed", "option_selected", "whatsapp_copied", "formula_opened",
    "agreement_created", "agreement_viewed", "agreement_approved",
    "agreement_change_requested", "project_actual_submitted",
}
MAX_ANALYTICS_PROPS_BYTES = 2000


@misc.get("/health")
async def health():
    db_configured = bool(MONGO_URL)
    db_mode = "mongo" if not db._use_memory else "memory"
    llm_configured = bool(ai_service.EMERGENT_LLM_KEY) and ai_service.LlmChat is not None
    return {
        "status": "ok",
        "formula_version": pricing.FORMULA_VERSION,
        "environment": ENVIRONMENT,
        "database": {"configured": db_configured, "mode": db_mode},
        "llm": {"configured": llm_configured},
    }


@misc.post("/analytics")
async def track(body: AnalyticsBody, request: Request):
    if body.event not in ALLOWED_ANALYTICS_EVENTS:
        raise HTTPException(status_code=422, detail="Unknown analytics event.")
    import json as _json
    if len(_json.dumps(body.props)) > MAX_ANALYTICS_PROPS_BYTES:
        raise HTTPException(status_code=422, detail="Analytics payload too large.")
    owner_type, owner_id = await resolve_owner(request)
    await db.analytics_events.insert_one({
        "event_id": uuid.uuid4().hex, "event": body.event, "props": body.props,
        "owner_type": owner_type, "owner_id": owner_id, "created_at": iso(now_utc()),
    })
    return {"ok": True}


app.include_router(auth.router)
app.include_router(analysis.router)
app.include_router(agreement.router)
app.include_router(account.router)
app.include_router(misc)

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
_origins += ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token")
        await db.scope_agreements.create_index("token", unique=True)
        await db.brief_analyses.create_index("analysis_id", unique=True)
        await db.projects.create_index([("owner_id", 1), ("project_id", 1)])
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(f"Index creation skipped/failed: {e}")
