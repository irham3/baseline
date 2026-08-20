"""Shared infrastructure: env, Mongo, datetime/serialization helpers, and auth resolution."""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import os
import uuid
import statistics
import copy
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

import auth as auth_mod


class _MemoryCursor:
    def __init__(self, docs: list[dict]):
        self.docs = docs

    async def to_list(self, length: int | None = None) -> list[dict]:
        out = self.docs if length is None else self.docs[:length]
        return [copy.deepcopy(d) for d in out]


class _MemoryCollection:
    def __init__(self):
        self.docs: list[dict] = []

    @staticmethod
    def _matches(doc: dict, query: dict) -> bool:
        return all(doc.get(k) == v for k, v in query.items())

    @staticmethod
    def _project(doc: dict, projection: Optional[dict]) -> dict:
        data = copy.deepcopy(doc)
        if not projection:
            return data
        if all(v == 0 for v in projection.values()):
            for key in projection:
                data.pop(key, None)
            return data
        return {key: data.get(key) for key, include in projection.items() if include}

    @staticmethod
    def _sort(docs: list[dict], sort: list[tuple[str, int]] | None) -> list[dict]:
        if not sort:
            return docs
        out = list(docs)
        for key, direction in reversed(sort):
            out.sort(key=lambda d: d.get(key) or "", reverse=direction < 0)
        return out

    async def insert_one(self, doc: dict):
        self.docs.append(copy.deepcopy(doc))
        return type("InsertOneResult", (), {"inserted_id": doc.get("_id")})()

    async def find_one(self, query: dict, projection: Optional[dict] = None, sort: list[tuple[str, int]] | None = None):
        matches = [d for d in self.docs if self._matches(d, query)]
        matches = self._sort(matches, sort)
        return self._project(matches[0], projection) if matches else None

    def find(self, query: dict, projection: Optional[dict] = None, sort: list[tuple[str, int]] | None = None):
        matches = [self._project(d, projection) for d in self.docs if self._matches(d, query)]
        return _MemoryCursor(self._sort(matches, sort))

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        target = next((d for d in self.docs if self._matches(d, query)), None)
        if target is None and upsert:
            target = copy.deepcopy(query)
            self.docs.append(target)
        if target is None:
            return type("UpdateResult", (), {"matched_count": 0, "modified_count": 0})()
        if "$set" in update:
            target.update(copy.deepcopy(update["$set"]))
        if "$push" in update:
            for key, value in update["$push"].items():
                target.setdefault(key, []).append(copy.deepcopy(value))
        return type("UpdateResult", (), {"matched_count": 1, "modified_count": 1})()

    async def delete_one(self, query: dict):
        for i, doc in enumerate(self.docs):
            if self._matches(doc, query):
                self.docs.pop(i)
                return type("DeleteResult", (), {"deleted_count": 1})()
        return type("DeleteResult", (), {"deleted_count": 0})()

    async def delete_many(self, query: dict):
        before = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches(d, query)]
        return type("DeleteResult", (), {"deleted_count": before - len(self.docs)})()

    async def count_documents(self, query: dict) -> int:
        return sum(1 for d in self.docs if self._matches(d, query))

    async def create_index(self, *args, **kwargs):
        return None


class _MemoryDatabase:
    def __init__(self):
        self._collections: dict[str, _MemoryCollection] = {}

    def __getattr__(self, name: str) -> _MemoryCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self._collections.setdefault(name, _MemoryCollection())

    def __getitem__(self, name: str) -> _MemoryCollection:
        return self.__getattr__(name)


class _CollectionProxy:
    def __init__(self, db_proxy, name: str):
        self._db_proxy = db_proxy
        self._name = name

    def _get_target(self):
        return self._db_proxy._get_collection(self._name)

    async def insert_one(self, *args, **kwargs):
        try:
            return await self._get_target().insert_one(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
            return await self._get_target().insert_one(*args, **kwargs)

    async def find_one(self, *args, **kwargs):
        try:
            return await self._get_target().find_one(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
            return await self._get_target().find_one(*args, **kwargs)

    def find(self, *args, **kwargs):
        try:
            if not self._db_proxy._use_memory and self._db_proxy._motor_db is not None:
                return self._db_proxy._motor_db[self._name].find(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
        return self._db_proxy._memory_db[self._name].find(*args, **kwargs)

    async def update_one(self, *args, **kwargs):
        try:
            return await self._get_target().update_one(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
            return await self._get_target().update_one(*args, **kwargs)

    async def delete_one(self, *args, **kwargs):
        try:
            return await self._get_target().delete_one(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
            return await self._get_target().delete_one(*args, **kwargs)

    async def delete_many(self, *args, **kwargs):
        try:
            return await self._get_target().delete_many(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
            return await self._get_target().delete_many(*args, **kwargs)

    async def count_documents(self, *args, **kwargs):
        try:
            return await self._get_target().count_documents(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
            return await self._get_target().count_documents(*args, **kwargs)

    async def create_index(self, *args, **kwargs):
        try:
            if not self._db_proxy._use_memory and self._db_proxy._motor_db is not None:
                return await self._db_proxy._motor_db[self._name].create_index(*args, **kwargs)
        except Exception as e:
            self._db_proxy._fallback(e)
        return None


class _DatabaseProxy:
    def __init__(self, motor_db, memory_db):
        self._motor_db = motor_db
        self._memory_db = memory_db
        self._use_memory = motor_db is None
        self._collections = {}

    def _fallback(self, error):
        if IS_PRODUCTION:
            # Production must never silently persist to memory: data would vanish on
            # restart while the app kept reporting success. Surface the failure instead.
            raise RuntimeError(
                f"MongoDB is unavailable in production ({error}). Refusing to fall back "
                "to in-memory storage; fix MONGO_URL/connectivity or restart once it recovers."
            ) from error
        if not self._use_memory:
            import logging
            logging.getLogger("uvicorn.error").warning(
                f"MongoDB connection failed ({error}); falling back to in-memory database "
                "(development/test only)."
            )
            self._use_memory = True

    def _get_collection(self, name: str):
        if self._use_memory or self._motor_db is None:
            return self._memory_db[name]
        return self._motor_db[name]

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = _CollectionProxy(self, name)
        return self._collections[name]

    def __getitem__(self, name: str):
        return self.__getattr__(name)


ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "baseline_dev")
_motor_client = None
_motor_db = None
if MONGO_URL:
    try:
        _motor_client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=2000)
        _motor_db = _motor_client[DB_NAME]
    except Exception as e:
        if IS_PRODUCTION:
            raise RuntimeError(f"ENVIRONMENT=production requires a working MONGO_URL; connection setup failed: {e}") from e
        _motor_client = None
        _motor_db = None
elif IS_PRODUCTION:
    raise RuntimeError("ENVIRONMENT=production requires MONGO_URL to be set; refusing to start on in-memory storage.")

client = _motor_client
_mem_db = _MemoryDatabase()
db = _DatabaseProxy(_motor_db, _mem_db)

GOOGLE_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
_cookie_secure_env = os.environ.get("COOKIE_SECURE")
if _cookie_secure_env is None:
    COOKIE_SECURE = False
else:
    COOKIE_SECURE = _cookie_secure_env.lower() in ("1", "true", "yes")
COOKIE_KW = dict(httponly=True, secure=COOKIE_SECURE, samesite="none" if COOKIE_SECURE else "lax", path="/")

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
    projects = await db.projects.find(
        {"owner_id": user_id}, {"_id": 0}, sort=[("created_at", -1)]
    ).to_list(length=MAX_MEMORY_PROJECTS)
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
