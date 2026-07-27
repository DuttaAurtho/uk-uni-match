"""CRUD for the user dashboard: search history, favorites, todos, per-
university document requirements, and the user<->admin chat thread.

Every write here is scoped to a `user_id`, so a user can never read or
mutate another user's rows (ownership is enforced in the WHERE clause of
every update/delete, not just checked beforehand).
"""

import json
import sqlite3
from typing import Any, Dict, List, Optional

import db


def _row(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Search history
# ---------------------------------------------------------------------------


def log_search(
    user_id: int, gpa, ielts, budget, course, city, result_count: int,
    conn: Optional[sqlite3.Connection] = None,
) -> None:
    own = conn is None
    conn = conn or db.connect()
    try:
        conn.execute(
            """
            INSERT INTO search_history (user_id, gpa, ielts, budget, course, city, result_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, gpa, ielts, budget, course, city, result_count),
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def list_history(user_id: int, limit: int = 50, conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        rows = conn.execute(
            "SELECT * FROM search_history WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


def list_favorites(user_id: int, conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        rows = conn.execute(
            """
            SELECT f.id AS favorite_id, f.created_at AS favorited_at, u.*
            FROM favorites f JOIN universities u ON u.id = f.university_id
            WHERE f.user_id = ?
            ORDER BY f.id DESC
            """,
            (user_id,),
        ).fetchall()
        results = []
        for r in rows:
            uni = dict(r)
            for column in ("intakes", "courses"):
                uni[column] = json.loads(uni[column]) if uni.get(column) else []
            results.append(uni)
        return results
    finally:
        if own:
            conn.close()


def add_favorite(user_id: int, university_id: int, conn: Optional[sqlite3.Connection] = None) -> int:
    own = conn is None
    conn = conn or db.connect()
    try:
        exists = conn.execute("SELECT 1 FROM universities WHERE id = ?", (university_id,)).fetchone()
        if not exists:
            raise ValueError("University not found")
        cur = conn.execute(
            "INSERT OR IGNORE INTO favorites (user_id, university_id) VALUES (?, ?)",
            (user_id, university_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id FROM favorites WHERE user_id = ? AND university_id = ?",
            (user_id, university_id),
        ).fetchone()
        return row["id"]
    finally:
        if own:
            conn.close()


def remove_favorite(user_id: int, university_id: int, conn: Optional[sqlite3.Connection] = None) -> bool:
    own = conn is None
    conn = conn or db.connect()
    try:
        cur = conn.execute(
            "DELETE FROM favorites WHERE user_id = ? AND university_id = ?",
            (user_id, university_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------


def list_todos(user_id: int, conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        rows = conn.execute(
            "SELECT * FROM todos WHERE user_id = ? ORDER BY is_done ASC, id DESC", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if own:
            conn.close()


def create_todo(
    user_id: int, title: str, due_date: Optional[str] = None,
    university_id: Optional[int] = None, conn: Optional[sqlite3.Connection] = None,
) -> int:
    own = conn is None
    conn = conn or db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO todos (user_id, title, due_date, university_id) VALUES (?, ?, ?, ?)",
            (user_id, title, due_date, university_id),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        if own:
            conn.close()


_TODO_FIELDS = ("title", "is_done", "due_date", "university_id")


def update_todo(
    user_id: int, todo_id: int, fields: Dict[str, Any], conn: Optional[sqlite3.Connection] = None
) -> bool:
    own = conn is None
    conn = conn or db.connect()
    try:
        data = {k: v for k, v in fields.items() if k in _TODO_FIELDS}
        if not data:
            return False
        set_clause = ", ".join(f"{c} = ?" for c in data)
        cur = conn.execute(
            f"UPDATE todos SET {set_clause} WHERE id = ? AND user_id = ?",
            [*data.values(), todo_id, user_id],
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


def delete_todo(user_id: int, todo_id: int, conn: Optional[sqlite3.Connection] = None) -> bool:
    own = conn is None
    conn = conn or db.connect()
    try:
        cur = conn.execute("DELETE FROM todos WHERE id = ? AND user_id = ?", (todo_id, user_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Per-university document requirements
# ---------------------------------------------------------------------------


def list_requirements(
    user_id: int, university_id: Optional[int] = None, conn: Optional[sqlite3.Connection] = None
) -> List[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        if university_id is not None:
            rows = conn.execute(
                "SELECT * FROM university_requirements WHERE user_id = ? AND university_id = ? ORDER BY id",
                (user_id, university_id),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM university_requirements WHERE user_id = ? ORDER BY university_id, id",
                (user_id,),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if own:
            conn.close()


def create_requirement(
    user_id: int, university_id: int, document_name: str, notes: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None,
) -> int:
    own = conn is None
    conn = conn or db.connect()
    try:
        exists = conn.execute("SELECT 1 FROM universities WHERE id = ?", (university_id,)).fetchone()
        if not exists:
            raise ValueError("University not found")
        cur = conn.execute(
            """
            INSERT INTO university_requirements (user_id, university_id, document_name, notes)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, university_id, document_name, notes),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        if own:
            conn.close()


_REQUIREMENT_FIELDS = ("document_name", "is_ready", "notes")


def update_requirement(
    user_id: int, req_id: int, fields: Dict[str, Any], conn: Optional[sqlite3.Connection] = None
) -> bool:
    own = conn is None
    conn = conn or db.connect()
    try:
        data = {k: v for k, v in fields.items() if k in _REQUIREMENT_FIELDS}
        if not data:
            return False
        set_clause = ", ".join(f"{c} = ?" for c in data)
        cur = conn.execute(
            f"UPDATE university_requirements SET {set_clause} WHERE id = ? AND user_id = ?",
            [*data.values(), req_id, user_id],
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


def delete_requirement(user_id: int, req_id: int, conn: Optional[sqlite3.Connection] = None) -> bool:
    own = conn is None
    conn = conn or db.connect()
    try:
        cur = conn.execute(
            "DELETE FROM university_requirements WHERE id = ? AND user_id = ?", (req_id, user_id)
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Chat — one thread per user, `sender_role` distinguishes the two sides
# ---------------------------------------------------------------------------


def list_messages(user_id: int, conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY id ASC", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if own:
            conn.close()


def add_message(
    user_id: int, sender_role: str, body: str, conn: Optional[sqlite3.Connection] = None
) -> Dict[str, Any]:
    own = conn is None
    conn = conn or db.connect()
    try:
        cur = conn.execute(
            "INSERT INTO chat_messages (user_id, sender_role, body) VALUES (?, ?, ?)",
            (user_id, sender_role, body),
        )
        conn.commit()
        return _row(conn.execute("SELECT * FROM chat_messages WHERE id = ?", (cur.lastrowid,)).fetchone())
    finally:
        if own:
            conn.close()


def mark_read(user_id: int, reader_role: str, conn: Optional[sqlite3.Connection] = None) -> None:
    """Mark every message the *other* side sent in this thread as read."""
    own = conn is None
    conn = conn or db.connect()
    try:
        other_role = "admin" if reader_role == "user" else "user"
        conn.execute(
            """
            UPDATE chat_messages SET read_at = datetime('now')
            WHERE user_id = ? AND sender_role = ? AND read_at IS NULL
            """,
            (user_id, other_role),
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def list_threads_for_admin(conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    """One row per user who has ever chatted, newest activity first, with
    the last message preview and how many of the user's messages are unread."""
    own = conn is None
    conn = conn or db.connect()
    try:
        rows = conn.execute(
            """
            SELECT
                u.id AS user_id,
                u.email AS email,
                u.avatar_seed AS avatar_seed,
                (SELECT body FROM chat_messages m WHERE m.user_id = u.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM chat_messages m WHERE m.user_id = u.id ORDER BY m.id DESC LIMIT 1) AS last_message_at,
                (SELECT COUNT(*) FROM chat_messages m WHERE m.user_id = u.id AND m.sender_role = 'user' AND m.read_at IS NULL) AS unread_count
            FROM users u
            WHERE u.role = 'user' AND EXISTS (SELECT 1 FROM chat_messages m WHERE m.user_id = u.id)
            ORDER BY last_message_at DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if own:
            conn.close()
