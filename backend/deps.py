"""FastAPI dependencies for reading the session cookie."""

import os
from typing import Any, Dict, Optional

from fastapi import Cookie, HTTPException

import auth

SESSION_COOKIE = "session"


def cookie_kwargs() -> Dict[str, Any]:
    """Attributes for setting/clearing the session cookie. The frontend
    (Vercel) and backend (per the Procfile, its own separate host) are
    different origins in production, which cross-site cookies require
    SameSite=None + Secure for; locally both run on http://localhost, where
    Secure cookies are dropped by the browser, so dev uses Lax + insecure."""
    is_prod = os.environ.get("ENV", "development").strip().lower() == "production"
    return {
        "httponly": True,
        "secure": is_prod,
        "samesite": "none" if is_prod else "lax",
        "max_age": auth.JWT_EXPIRY_DAYS * 24 * 60 * 60,
        "path": "/",
    }


def _user_from_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    payload = auth.decode_session_token(token)
    if not payload:
        return None
    return auth.get_user_by_id(int(payload["sub"]))


def get_current_user(session: Optional[str] = Cookie(None)) -> Dict[str, Any]:
    user = _user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_current_user_optional(session: Optional[str] = Cookie(None)) -> Optional[Dict[str, Any]]:
    return _user_from_token(session)


def require_admin(session: Optional[str] = Cookie(None)) -> Dict[str, Any]:
    user = _user_from_token(session)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
