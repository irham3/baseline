"""Agreement Sheet routes: create, public read, respond, demo."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Request, HTTPException

import scope as scope_mod
from core import db, now_utc, iso, resolve_owner
from models import AgreementBody, AgreementResponseBody, DemoAgreementBody

router = APIRouter(prefix="/api")


async def _owned_analysis(analysis_id: str, request: Request) -> dict:
    doc = await db.brief_analyses.find_one({"analysis_id": analysis_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    _, owner_id = await resolve_owner(request)
    if doc["owner_id"] != owner_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return doc


@router.post("/analysis/{analysis_id}/agreement")
async def create_agreement(analysis_id: str, body: AgreementBody, request: Request):
    doc = await _owned_analysis(analysis_id, request)
    token = secrets.token_urlsafe(24)
    agreement = {
        "token": token, "analysis_id": analysis_id,
        "owner_type": doc["owner_type"], "owner_id": doc["owner_id"],
        "snapshot": scope_mod.agreement_snapshot(body.option, body.project_title, body.client_name),
        "status": "SENT", "responses": [],
        "created_at": iso(now_utc()), "expires_at": iso(now_utc() + timedelta(days=7)),
    }
    await db.scope_agreements.insert_one(agreement)
    await db.brief_analyses.update_one({"analysis_id": analysis_id},
                                       {"$set": {"state": "SHARED", "shared_token": token}})
    return {"token": token, "status": "SENT"}


@router.post("/demo/agreement")
async def demo_agreement(body: DemoAgreementBody):
    seed = scope_mod.compute_seed_analysis()
    opt = next((o for o in seed["options"] if o["id"] == body.option_id), seed["options"][1])
    token = secrets.token_urlsafe(24)
    agreement = {
        "token": token, "analysis_id": None, "owner_type": "demo", "owner_id": "demo", "is_demo": True,
        "snapshot": scope_mod.agreement_snapshot(opt, body.project_title, None, is_demo=True),
        "status": "SENT", "responses": [],
        "created_at": iso(now_utc()), "expires_at": iso(now_utc() + timedelta(days=7)),
    }
    await db.scope_agreements.insert_one(agreement)
    return {"token": token, "status": "SENT"}


@router.get("/agreement/{token}")
async def get_agreement(token: str):
    doc = await db.scope_agreements.find_one({"token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Agreement Sheet not found or already deleted.")
    expires_at = datetime.fromisoformat(doc["expires_at"])
    expired = expires_at < now_utc()
    return {
        "token": doc["token"],
        "status": "EXPIRED" if (expired and doc["status"] == "SENT") else doc["status"],
        "snapshot": doc["snapshot"],
        "responses": [{"action": r["action"], "created_at": r["created_at"]} for r in doc.get("responses", [])],
        "created_at": doc["created_at"], "expires_at": doc["expires_at"], "expired": expired,
    }


@router.post("/agreement/{token}/respond")
async def respond_agreement(token: str, body: AgreementResponseBody):
    doc = await db.scope_agreements.find_one({"token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Agreement Sheet not found.")
    if datetime.fromisoformat(doc["expires_at"]) < now_utc():
        raise HTTPException(status_code=410, detail="This offer has expired.")
    status_map = {"approve": "APPROVED", "request_changes": "CHANGE_REQUESTED", "ask_question": "SENT"}
    legacy_status_map = {"setuju": "APPROVED", "minta_perubahan": "CHANGE_REQUESTED", "tanyakan_detail": "SENT"}
    if body.action not in status_map:
        if body.action in legacy_status_map:
            status = legacy_status_map[body.action]
        else:
            raise HTTPException(status_code=422, detail="Invalid action.")
    else:
        status = status_map[body.action]
    response = {"action": body.action, "message": body.message, "created_at": iso(now_utc())}
    await db.scope_agreements.update_one(
        {"token": token}, {"$push": {"responses": response}, "$set": {"status": status}})
    return {"ok": True, "status": status}
