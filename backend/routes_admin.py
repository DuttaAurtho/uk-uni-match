"""Admin-only routes: manage the universities dataset, list users, and
reply to user chat threads. Every route requires the admin role (see
deps.require_admin) — there's exactly one admin account, seeded via
scripts/create_admin.py.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
import dashboard_db
import db
from deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------------------------------------------------------------------------
# Universities
# ---------------------------------------------------------------------------


class UniversityUpsert(BaseModel):
    name: str
    city: str
    min_gpa: Optional[float] = None
    min_ielts: Optional[float] = None
    annual_tuition_gbp: Optional[int] = None
    scholarship: Optional[str] = ""
    intakes: List[str] = []
    courses: List[str] = []
    data_status: Optional[str] = "Estimated - please verify"
    official_url: Optional[str] = ""


class UniversityPatch(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    min_gpa: Optional[float] = None
    min_ielts: Optional[float] = None
    annual_tuition_gbp: Optional[int] = None
    scholarship: Optional[str] = None
    intakes: Optional[List[str]] = None
    courses: Optional[List[str]] = None
    data_status: Optional[str] = None
    official_url: Optional[str] = None


@router.get("/universities")
def list_universities():
    return {"universities": db.load_universities()}


@router.post("/universities")
def create_university(payload: UniversityUpsert):
    try:
        uni_id = db.insert_university(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Couldn't create university: {exc}")
    db.refresh()
    return {"id": uni_id, "universities": db.load_universities()}


@router.put("/universities/{uni_id}")
def update_university(uni_id: int, payload: UniversityPatch):
    fields = payload.model_dump(exclude_unset=True)
    if not db.update_university(uni_id, fields):
        raise HTTPException(status_code=404, detail="University not found")
    db.refresh()
    return {"universities": db.load_universities()}


@router.delete("/universities/{uni_id}")
def delete_university(uni_id: int):
    if not db.delete_university(uni_id):
        raise HTTPException(status_code=404, detail="University not found")
    db.refresh()
    return {"universities": db.load_universities()}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users")
def list_users():
    return {"users": auth.list_users()}


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


@router.get("/chat/threads")
def list_threads():
    return {"threads": dashboard_db.list_threads_for_admin()}


@router.get("/chat/{user_id}")
def get_thread(user_id: int):
    target = auth.get_user_by_id(user_id)
    if not target or target["role"] != "user":
        raise HTTPException(status_code=404, detail="User not found")
    dashboard_db.mark_read(user_id, reader_role="admin")
    return {"messages": dashboard_db.list_messages(user_id)}


class AdminChatMessageRequest(BaseModel):
    body: str


@router.post("/chat/{user_id}")
def post_thread_message(user_id: int, payload: AdminChatMessageRequest):
    target = auth.get_user_by_id(user_id)
    if not target or target["role"] != "user":
        raise HTTPException(status_code=404, detail="User not found")
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty")
    dashboard_db.add_message(user_id, "admin", payload.body.strip())
    return {"messages": dashboard_db.list_messages(user_id)}
