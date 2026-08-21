"""Agreement Sheet routes: create, public read, respond, revoke, demo.

Security contract: the browser never supplies price, quantity, timeline, or any other
numeric deal term when creating an Agreement Sheet. It sends only an option_id; the
backend resolves the actual option from the server-stored, already-computed analysis.
"""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Request, HTTPException, Depends

import pricing
import scope as scope_mod
from core import db, now_utc, iso, resolve_owner
from rate_limit import rate_limit
from models import AgreementBody, AgreementResponseBody, DemoAgreementBody

router = APIRouter(prefix="/api")

TERMINAL_STATUSES = {"APPROVED", "REVOKED"}


def _snapshot_hash(snapshot: dict) -> str:
    payload = json.dumps(snapshot, sort_keys=True, default=str)
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
    options = doc.get("options")
    if not options:
        raise HTTPException(
            status_code=422,
            detail="This analysis has no computed options yet. Run an estimate before creating an Agreement Sheet.",
        )
    opt = next((o for o in options if o.get("id") == body.option_id), None)
    if opt is None:
        raise HTTPException(status_code=422, detail="Unknown option ID for this analysis.")
    if opt.get("price") is None or opt.get("type") == "no_viable_scope":
        raise HTTPException(status_code=422, detail="This option has no viable price and cannot become an Agreement Sheet.")

    token = secrets.token_urlsafe(24)
    snapshot = scope_mod.agreement_snapshot(opt, body.project_title.strip(), (body.client_name or "").strip() or None)
    agreement = {
        "token": token,
        "analysis_id": analysis_id,
        "owner_type": doc["owner_type"],
        "owner_id": doc["owner_id"],
        "option_id": body.option_id,
        "snapshot": snapshot,
        "snapshot_version": scope_mod.AGREEMENT_SNAPSHOT_VERSION,
        "formula_version": doc.get("formula_version", pricing.FORMULA_VERSION),
        "snapshot_hash": _snapshot_hash(snapshot),
        "status": "SENT",
        "status_history": [{"status": "SENT", "at": iso(now_utc())}],
        "responses": [],
        "created_at": iso(now_utc()),
        "expires_at": iso(now_utc() + timedelta(days=7)),
    }
    await db.scope_agreements.insert_one(agreement)
    await db.brief_analyses.update_one({"analysis_id": analysis_id},
                                       {"$set": {"state": "SHARED", "shared_token": token}})
    return {"token": token, "status": "SENT"}


@router.post("/analysis/{analysis_id}/agreement/{token}/revoke")
async def revoke_agreement(analysis_id: str, token: str, request: Request):
    await _owned_analysis(analysis_id, request)
    agreement = await db.scope_agreements.find_one({"token": token})
    if not agreement or agreement.get("analysis_id") != analysis_id:
        raise HTTPException(status_code=404, detail="Agreement Sheet not found.")
    if agreement["status"] == "APPROVED":
        raise HTTPException(status_code=409, detail="An approved Agreement Sheet cannot be revoked; create a new version instead.")
    if agreement["status"] == "REVOKED":
        return {"ok": True, "status": "REVOKED"}
    await db.scope_agreements.update_one(
        {"token": token},
        {"$set": {"status": "REVOKED"}, "$push": {"status_history": {"status": "REVOKED", "at": iso(now_utc())}}},
    )
    return {"ok": True, "status": "REVOKED"}


@router.post("/demo/agreement", dependencies=[Depends(rate_limit("demo-agreement", 10, 60))])
async def demo_agreement(body: DemoAgreementBody):
    seed = scope_mod.compute_seed_analysis()
    opt = next((o for o in seed["options"] if o["id"] == body.option_id and o.get("price") is not None), seed["options"][1])
    token = secrets.token_urlsafe(24)
    snapshot = scope_mod.agreement_snapshot(opt, body.project_title, None, is_demo=True)
    agreement = {
        "token": token, "analysis_id": None, "owner_type": "demo", "owner_id": "demo", "is_demo": True,
        "option_id": opt["id"],
        "snapshot": snapshot,
        "snapshot_version": scope_mod.AGREEMENT_SNAPSHOT_VERSION,
        "formula_version": seed["formula_version"],
        "snapshot_hash": _snapshot_hash(snapshot),
        "status": "SENT",
        "status_history": [{"status": "SENT", "at": iso(now_utc())}],
        "responses": [],
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
    if status == "SENT" and expired:
        status = "EXPIRED"
    return {
        "token": doc["token"],
        "status": status,
        "snapshot": doc["snapshot"],
        "snapshot_version": doc.get("snapshot_version"),
        "formula_version": doc.get("formula_version"),
        "responses": [{"action": r["action"], "created_at": r["created_at"]} for r in doc.get("responses", [])],
        "created_at": doc["created_at"], "expires_at": doc["expires_at"], "expired": expired,
    }


@router.post("/agreement/{token}/respond", dependencies=[Depends(rate_limit("agreement-respond", 10, 60))])
async def respond_agreement(token: str, body: AgreementResponseBody):
    doc = await db.scope_agreements.find_one({"token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Agreement Sheet not found.")
    if doc["status"] == "REVOKED":
        raise HTTPException(status_code=410, detail="This offer has been revoked.")
    if datetime.fromisoformat(doc["expires_at"]) < now_utc():
        raise HTTPException(status_code=410, detail="This offer has expired.")
    if doc["status"] == "APPROVED":
        raise HTTPException(status_code=409, detail="This offer has already been approved and cannot be changed.")

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
        {"token": token},
        {
            "$push": {"responses": response, "status_history": {"status": status, "at": iso(now_utc())}},
            "$set": {"status": status},
        },
    )
    return {"ok": True, "status": status}
