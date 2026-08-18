"""Account routes: cost profile + multi-project Personal Estimation Memory."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Request, Depends, HTTPException

import core
from core import db, now_utc, iso, clean, resolve_owner, require_user, MAX_MEMORY_PROJECTS
from models import CostProfileBody, ProjectBody
from routers.analysis import compute_cost_per_hour

router = APIRouter(prefix="/api")


@router.post("/cost-profile")
async def save_cost_profile(body: CostProfileBody, request: Request):
    cph, complete = compute_cost_per_hour(body)
    owner_type, owner_id = await resolve_owner(request)
    doc = {
        "owner_type": owner_type, "owner_id": owner_id, **body.model_dump(),
        "cost_per_hour": round(cph) if cph else None, "complete": complete,
        "updated_at": iso(now_utc()),
    }
    if owner_type == "user":
        await db.cost_profiles.update_one({"owner_id": owner_id}, {"$set": doc}, upsert=True)
    return clean(doc)


@router.get("/cost-profile")
async def get_cost_profile(user: dict = Depends(require_user)):
    return await db.cost_profiles.find_one({"owner_id": user["user_id"]}, {"_id": 0}) or {}


# -------- Multi-project Personal Estimation Memory --------
@router.get("/projects")
async def list_projects(user: dict = Depends(require_user)):
    projects = await db.projects.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(length=MAX_MEMORY_PROJECTS)
    summary = await core.calibration_summary(user["user_id"])
    return {"projects": projects, "summary": summary}


@router.post("/projects")
async def add_project(body: ProjectBody, user: dict = Depends(require_user)):
    if body.estimated_hours <= 0 or body.actual_hours <= 0:
        raise HTTPException(status_code=422, detail="Estimasi dan jam aktual harus lebih dari 0.")
    count = await db.projects.count_documents({"owner_id": user["user_id"]})
    if count >= MAX_MEMORY_PROJECTS:
        raise HTTPException(status_code=400, detail=f"Maksimal {MAX_MEMORY_PROJECTS} proyek. Hapus salah satu dulu.")
    project_id = uuid.uuid4().hex[:10]
    doc = {
        "owner_id": user["user_id"], "project_id": project_id, **body.model_dump(),
        "factor": round(body.actual_hours / body.estimated_hours, 3), "created_at": iso(now_utc()),
    }
    await db.projects.insert_one(doc)
    return clean(dict(doc))


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(require_user)):
    await db.projects.delete_one({"owner_id": user["user_id"], "project_id": project_id})
    return {"ok": True}
