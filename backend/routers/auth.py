"""Auth routes: JWT email/password + Emergent Google session."""
from __future__ import annotations

import uuid
from datetime import timedelta

import httpx
from fastapi import APIRouter, Request, Response, HTTPException, Depends

import auth as auth_mod
from core import db, now_utc, iso, clean, COOKIE_KW, GOOGLE_SESSION_URL, require_user
from models import RegisterBody, LoginBody, GoogleSessionBody

router = APIRouter(prefix="/api/auth")


def _set_jwt_cookies(response: Response, user_id: str, email: str):
    response.set_cookie("access_token", auth_mod.create_access_token(user_id, email),
                        max_age=auth_mod.ACCESS_TOKEN_DAYS * 86400, **COOKIE_KW)
    response.set_cookie("refresh_token", auth_mod.create_refresh_token(user_id),
                        max_age=auth_mod.REFRESH_TOKEN_DAYS * 86400, **COOKIE_KW)


@router.post("/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email is already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    name = body.name or email.split("@")[0]
    await db.users.insert_one({
        "user_id": user_id, "email": email,
        "password_hash": auth_mod.hash_password(body.password),
        "name": name, "auth_provider": "password", "created_at": iso(now_utc()),
    })
    _set_jwt_cookies(response, user_id, email)
    return {"user_id": user_id, "email": email, "name": name, "auth_provider": "password"}


@router.post("/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not auth_mod.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    _set_jwt_cookies(response, user["user_id"], email)
    return clean(user)


@router.post("/refresh")
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


@router.post("/logout")
async def logout(request: Request, response: Response):
    session = request.cookies.get("session_token")
    if session:
        await db.user_sessions.delete_one({"session_token": session})
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(require_user)):
    return user


@router.post("/google/session")
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
            "user_id": user_id, "email": email, "name": data.get("name"),
            "picture": data.get("picture"), "auth_provider": "google", "created_at": iso(now_utc()),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": iso(now_utc() + timedelta(days=7)), "created_at": iso(now_utc()),
    })
    response.set_cookie("session_token", session_token, max_age=7 * 86400, **COOKIE_KW)
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
