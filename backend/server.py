"""Baseline API entrypoint — assembles routers, CORS, health, analytics, startup."""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import uuid

from fastapi import FastAPI, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware

import pricing
from core import db, now_utc, iso, resolve_owner
from models import AnalyticsBody
from routers import auth, analysis, agreement, account

app = FastAPI(title="Baseline API")

misc = APIRouter(prefix="/api")


@misc.get("/health")
async def health():
    return {"status": "ok", "formula_version": pricing.FORMULA_VERSION}


@misc.post("/analytics")
async def track(body: AnalyticsBody, request: Request):
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


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token")
    await db.scope_agreements.create_index("token", unique=True)
    await db.brief_analyses.create_index("analysis_id", unique=True)
    await db.projects.create_index([("owner_id", 1), ("project_id", 1)])
