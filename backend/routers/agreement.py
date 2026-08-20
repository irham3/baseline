"""Agreement Sheet routes: create, public read, respond, revoke, demo."""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Request, HTTPException

import pricing
import scope as scope_mod
from core import db, now_utc, iso, resolve_owner
from models import AgreementBody, AgreementResponseBody, DemoAgreementBody

router = APIRouter(prefix="/api")


def _snapshot_hash(snapshot: dict, formula_version: str) -> str:
    payload = json.dumps(snapshot, sort_keys=True, ensure_ascii=False) + "|" + formula_version
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


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
    # Numbers come only from the server-stored deterministic options — never from the client.
    options = doc.get("options")
    if not doc.get("estimate") or not options:
        raise HTTPException(status_code=422, detail="This analysis has no priced options yet. Run the estimate first.")
    opt = next((o for o in options if o.get("id") == body.option_id), None)
    if not opt:
        raise HTTPException(status_code=422, detail="Unknown option_id for this analysis.")
    if not opt.get("viable", True) or opt.get("price") is None:
        raise HTTPException(status_code=422, detail="This option is not viable at the client budget and cannot become an agreement.")

    snapshot = scope_mod.agreement_snapshot(opt, body.project_title, body.client_name)
    formula_version = doc.get("formula_version") or pricing.FORMULA_VERSION
    token = secrets.token_urlsafe(24)
    agreement = {
        "token": token, "analysis_id": analysis_id,
        "owner_type": doc["owner_type"], "owner_id": doc["owner_id"],
        "option_id": body.option_id,
        "snapshot": snapshot,
        "snapshot_version": 1,
        "formula_version": formula_version,
        "snapshot_hash": _snapshot_hash(snapshot, formula_version),
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
    snapshot = scope_mod.agreement_snapshot(opt, body.project_title, None, is_demo=True)
    formula_version = seed.get("formula_version") or pricing.FORMULA_VERSION
    token = secrets.token_urlsafe(24)
    agreement = {
        "token": token, "analysis_id": None, "owner_type": "demo", "owner_id": "demo", "is_demo": True,
        "option_id": opt["id"],
        "snapshot": snapshot,
        "snapshot_version": 1,
        "formula_version": formula_version,
        "snapshot_hash": _snapshot_hash(snapshot, formula_version),
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
    status = doc["status"]
    if expired and status == "SENT":
        status = "EXPIRED"
    return {
        "token": doc["token"],
        "status": status,
        "snapshot": doc["snapshot"],
        "snapshot_hash": doc.get("snapshot_hash"),
        "snapshot_version": doc.get("snapshot_version", 1),
        "formula_version": doc.get("formula_version"),
        "responses": [{"action": r["action"], "created_at": r["created_at"]} for r in doc.get("responses", [])],
        "created_at": doc["created_at"], "expires_at": doc["expires_at"], "expired": expired,
    }


@router.post("/agreement/{token}/respond")
async def respond_agreement(token: str, body: AgreementResponseBody):
    doc = await db.scope_agreements.find_one({"token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Agreement Sheet not found.")
    if doc["status"] == "REVOKED":
        raise HTTPException(status_code=410, detail="This offer has been revoked by the owner.")
    if doc["status"] == "APPROVED":
        raise HTTPException(status_code=409,
                            detail="This agreement is already approved and locked. The owner must create a new version to change it.")
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
    res = await db.scope_agreements.update_one(
        {"token": token, "status": {"$nin": ["APPROVED", "REVOKED"]}},
        {"$push": {"responses": response}, "$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=409, detail="This agreement is locked and can no longer be changed.")
    return {"ok": True, "status": status}


@router.post("/analysis/{analysis_id}/agreement/{token}/revoke")
async def revoke_agreement(analysis_id: str, token: str, request: Request):
    await _owned_analysis(analysis_id, request)  # ownership enforced
    ag = await db.scope_agreements.find_one({"token": token, "analysis_id": analysis_id})
    if not ag:
        raise HTTPException(status_code=404, detail="Agreement Sheet not found.")
    await db.scope_agreements.update_one({"token": token}, {"$set": {"status": "REVOKED"}})
    return {"ok": True, "status": "REVOKED"}
