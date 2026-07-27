"""The logged-in user's own dashboard: search history, favorites, todos,
per-university document requirements, avatar, and their chat thread with
the admin. Every route requires a valid session (see deps.get_current_user).
"""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
import dashboard_db
from deps import get_current_user

router = APIRouter(prefix="/me", tags=["dashboard"])


@router.get("/history")
def get_history(user=Depends(get_current_user)):
    return {"history": dashboard_db.list_history(user["id"])}


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


@router.get("/favorites")
def get_favorites(user=Depends(get_current_user)):
    return {"favorites": dashboard_db.list_favorites(user["id"])}


class FavoriteRequest(BaseModel):
    university_id: int


@router.post("/favorites")
def add_favorite(payload: FavoriteRequest, user=Depends(get_current_user)):
    try:
        dashboard_db.add_favorite(user["id"], payload.university_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"favorites": dashboard_db.list_favorites(user["id"])}


@router.delete("/favorites/{university_id}")
def remove_favorite(university_id: int, user=Depends(get_current_user)):
    if not dashboard_db.remove_favorite(user["id"], university_id):
        raise HTTPException(status_code=404, detail="Not in favorites")
    return {"favorites": dashboard_db.list_favorites(user["id"])}


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------


@router.get("/todos")
def get_todos(user=Depends(get_current_user)):
    return {"todos": dashboard_db.list_todos(user["id"])}


class CreateTodoRequest(BaseModel):
    title: str
    due_date: Optional[str] = None
    university_id: Optional[int] = None


@router.post("/todos")
def create_todo(payload: CreateTodoRequest, user=Depends(get_current_user)):
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    todo_id = dashboard_db.create_todo(user["id"], payload.title.strip(), payload.due_date, payload.university_id)
    return {"id": todo_id, "todos": dashboard_db.list_todos(user["id"])}


class UpdateTodoRequest(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None
    due_date: Optional[str] = None
    university_id: Optional[int] = None


@router.patch("/todos/{todo_id}")
def update_todo(todo_id: int, payload: UpdateTodoRequest, user=Depends(get_current_user)):
    fields = payload.model_dump(exclude_unset=True)
    if not dashboard_db.update_todo(user["id"], todo_id, fields):
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"todos": dashboard_db.list_todos(user["id"])}


@router.delete("/todos/{todo_id}")
def delete_todo(todo_id: int, user=Depends(get_current_user)):
    if not dashboard_db.delete_todo(user["id"], todo_id):
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"todos": dashboard_db.list_todos(user["id"])}


# ---------------------------------------------------------------------------
# Per-university document requirements
# ---------------------------------------------------------------------------


@router.get("/requirements")
def get_requirements(university_id: Optional[int] = None, user=Depends(get_current_user)):
    return {"requirements": dashboard_db.list_requirements(user["id"], university_id)}


class CreateRequirementRequest(BaseModel):
    university_id: int
    document_name: str
    notes: Optional[str] = None


@router.post("/requirements")
def create_requirement(payload: CreateRequirementRequest, user=Depends(get_current_user)):
    if not payload.document_name.strip():
        raise HTTPException(status_code=400, detail="Document name is required")
    try:
        req_id = dashboard_db.create_requirement(
            user["id"], payload.university_id, payload.document_name.strip(), payload.notes
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"id": req_id, "requirements": dashboard_db.list_requirements(user["id"], payload.university_id)}


class UpdateRequirementRequest(BaseModel):
    document_name: Optional[str] = None
    is_ready: Optional[bool] = None
    notes: Optional[str] = None


@router.patch("/requirements/{req_id}")
def update_requirement(req_id: int, payload: UpdateRequirementRequest, user=Depends(get_current_user)):
    fields = payload.model_dump(exclude_unset=True)
    if not dashboard_db.update_requirement(user["id"], req_id, fields):
        raise HTTPException(status_code=404, detail="Requirement not found")
    return {"requirements": dashboard_db.list_requirements(user["id"])}


@router.delete("/requirements/{req_id}")
def delete_requirement(req_id: int, user=Depends(get_current_user)):
    if not dashboard_db.delete_requirement(user["id"], req_id):
        raise HTTPException(status_code=404, detail="Requirement not found")
    return {"requirements": dashboard_db.list_requirements(user["id"])}


# ---------------------------------------------------------------------------
# Avatar
# ---------------------------------------------------------------------------


@router.post("/avatar/shuffle")
def shuffle_avatar(user=Depends(get_current_user)):
    seed = secrets.token_hex(6)
    auth.set_user_avatar_seed(user["id"], seed)
    return {"avatar_seed": seed}


class SetAvatarSeedRequest(BaseModel):
    seed: str


@router.post("/avatar")
def set_avatar(payload: SetAvatarSeedRequest, user=Depends(get_current_user)):
    seed = payload.seed.strip()[:64]
    if not seed:
        raise HTTPException(status_code=400, detail="Seed is required")
    auth.set_user_avatar_seed(user["id"], seed)
    return {"avatar_seed": seed}


# ---------------------------------------------------------------------------
# Chat with the admin
# ---------------------------------------------------------------------------


@router.get("/chat")
def get_chat(user=Depends(get_current_user)):
    dashboard_db.mark_read(user["id"], reader_role="user")
    return {"messages": dashboard_db.list_messages(user["id"])}


class ChatMessageRequest(BaseModel):
    body: str


@router.post("/chat")
def post_chat(payload: ChatMessageRequest, user=Depends(get_current_user)):
    if not payload.body.strip():
        raise HTTPException(status_code=400, detail="Message can't be empty")
    dashboard_db.add_message(user["id"], "user", payload.body.strip())
    return {"messages": dashboard_db.list_messages(user["id"])}
