"""Password hashing, JWT sessions, and OTP codes for accounts.

Two purposes share the `otp_codes` table: `verify_email` (signup) and
`reset_password` (forgot-password). Only a SHA-256 hash of the 6-digit code
is ever stored — the plaintext code exists only in memory and in the email
sent to the user — and `attempts` caps brute force at the application layer
even though the code space is small and codes are short-lived.
"""

import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
from dotenv import load_dotenv

import db

load_dotenv()

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60


def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set")
    return secret


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT sessions
# ---------------------------------------------------------------------------


def create_session_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """The token's payload, or None if missing/expired/tampered."""
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def create_user(
    email: str, password: str, role: str = "user", is_verified: bool = False,
    conn: Optional[sqlite3.Connection] = None,
) -> int:
    own = conn is None
    conn = conn or db.connect()
    try:
        cur = conn.execute(
            """
            INSERT INTO users (email, password_hash, role, is_verified, avatar_seed)
            VALUES (?, ?, ?, ?, ?)
            """,
            (email.strip().lower(), hash_password(password), role, int(is_verified), secrets.token_hex(6)),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        if own:
            conn.close()


def get_user_by_email(email: str, conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()
        return dict(row) if row else None
    finally:
        if own:
            conn.close()


def get_user_by_id(user_id: int, conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
    own = conn is None
    conn = conn or db.connect()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        if own:
            conn.close()


def set_user_verified(user_id: int, conn: Optional[sqlite3.Connection] = None) -> None:
    own = conn is None
    conn = conn or db.connect()
    try:
        conn.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user_id,))
        conn.commit()
    finally:
        if own:
            conn.close()


def set_user_password(user_id: int, password: str, conn: Optional[sqlite3.Connection] = None) -> None:
    own = conn is None
    conn = conn or db.connect()
    try:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(password), user_id),
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def set_user_avatar_seed(user_id: int, seed: str, conn: Optional[sqlite3.Connection] = None) -> None:
    own = conn is None
    conn = conn or db.connect()
    try:
        conn.execute("UPDATE users SET avatar_seed = ? WHERE id = ?", (seed, user_id))
        conn.commit()
    finally:
        if own:
            conn.close()


def list_users(conn: Optional[sqlite3.Connection] = None) -> Any:
    """Every non-admin account, for the admin panel's user list."""
    own = conn is None
    conn = conn or db.connect()
    try:
        rows = conn.execute(
            """
            SELECT id, email, is_verified, avatar_seed, created_at FROM users
            WHERE role = 'user' ORDER BY created_at DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        if own:
            conn.close()


def upsert_admin(email: str, password: str, conn: Optional[sqlite3.Connection] = None) -> int:
    """Create the admin account, or reset its password if it already exists.
    Used by scripts/create_admin.py — never called from a request handler."""
    own = conn is None
    conn = conn or db.connect()
    try:
        existing = get_user_by_email(email, conn)
        if existing:
            conn.execute(
                "UPDATE users SET password_hash = ?, role = 'admin', is_verified = 1 WHERE id = ?",
                (hash_password(password), existing["id"]),
            )
            conn.commit()
            return existing["id"]
        return create_user(email, password, role="admin", is_verified=True, conn=conn)
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# OTP codes
# ---------------------------------------------------------------------------


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def discard_latest_otp(
    user_id: int, purpose: str, conn: Optional[sqlite3.Connection] = None
) -> None:
    """Drop the most recent code for this user/purpose.

    Called when the email carrying it failed to send. The resend cooldown is
    measured from when a code row was created, so without this a failed
    delivery would still block the next attempt — telling the user "we
    already sent you a code" when nothing ever reached them."""
    own = conn is None
    conn = conn or db.connect()
    try:
        conn.execute(
            """
            DELETE FROM otp_codes
            WHERE id = (
                SELECT id FROM otp_codes
                WHERE user_id = ? AND purpose = ?
                ORDER BY id DESC LIMIT 1
            )
            """,
            (user_id, purpose),
        )
        conn.commit()
    finally:
        if own:
            conn.close()


def seconds_until_resend_allowed(
    user_id: int, purpose: str, conn: Optional[sqlite3.Connection] = None
) -> int:
    """0 if a new OTP can be sent now, else how many seconds to wait."""
    own = conn is None
    conn = conn or db.connect()
    try:
        row = conn.execute(
            """
            SELECT created_at FROM otp_codes
            WHERE user_id = ? AND purpose = ?
            ORDER BY id DESC LIMIT 1
            """,
            (user_id, purpose),
        ).fetchone()
        if not row:
            return 0
        created_at = datetime.fromisoformat(row["created_at"]).replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - created_at).total_seconds()
        remaining = OTP_RESEND_COOLDOWN_SECONDS - elapsed
        return max(0, int(remaining))
    finally:
        if own:
            conn.close()


def create_otp(user_id: int, purpose: str, conn: Optional[sqlite3.Connection] = None) -> str:
    """Issue a fresh 6-digit code for `user_id`/`purpose`. Returns the
    plaintext code — the only place it ever exists outside the outbound
    email — for the caller to hand to email_client."""
    own = conn is None
    conn = conn or db.connect()
    try:
        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
        conn.execute(
            """
            INSERT INTO otp_codes (user_id, code_hash, purpose, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, _hash_code(code), purpose, expires_at.isoformat()),
        )
        conn.commit()
        return code
    finally:
        if own:
            conn.close()


def verify_otp(
    user_id: int, purpose: str, code: str, conn: Optional[sqlite3.Connection] = None
) -> bool:
    """Check `code` against the most recent unconsumed OTP for this
    user/purpose. Consumes it on success; counts the attempt on failure."""
    own = conn is None
    conn = conn or db.connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM otp_codes
            WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL
            ORDER BY id DESC LIMIT 1
            """,
            (user_id, purpose),
        ).fetchone()
        if not row:
            return False
        if row["attempts"] >= OTP_MAX_ATTEMPTS:
            return False
        expires_at = datetime.fromisoformat(row["expires_at"]).replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            return False

        if not secrets.compare_digest(row["code_hash"], _hash_code(code)):
            conn.execute(
                "UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", (row["id"],)
            )
            conn.commit()
            return False

        conn.execute(
            "UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?", (row["id"],)
        )
        conn.commit()
        return True
    finally:
        if own:
            conn.close()
