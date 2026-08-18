"""Shared infrastructure: env, Mongo, datetime/serialization helpers, and auth resolution."""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import uuid
import statistics
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

import auth as auth_mod

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

GOOGLE_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
COOKIE_KW = dict(httponly=True, secure=True, samesite="none", path="/")

MAX_MEMORY_PROJECTS = 5


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


# --------------------------------------------------------------------------
# Auth resolution (shared across routers)
# --------------------------------------------------------------------------
async def _user_from_jwt(token: str) -> Optional[dict]:
    payload = auth_mod.decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    return await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})


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
# Multi-project calibration (median correction signal)
# --------------------------------------------------------------------------
async def calibration_summary(user_id: str) -> Optional[dict]:
    """Median hours-correction factor across a freelancer's saved projects (max 5)."""
    projects = await db.projects.find({"owner_id": user_id}, {"_id": 0}).to_list(length=MAX_MEMORY_PROJECTS)
    if not projects:
        return None
    factors = [p["factor"] for p in projects if p.get("factor")]
    if not factors:
        return None
    median = statistics.median(factors)
    count = len(factors)
    confidence = "medium" if count >= 3 else "low"
    return {
        "median_factor": round(median, 3),
        "count": count,
        "confidence": confidence,
        "projects": [
            {"project_name": p["project_name"], "factor": p["factor"],
             "estimated_hours": p["estimated_hours"], "actual_hours": p["actual_hours"]}
            for p in projects
        ],
    }
