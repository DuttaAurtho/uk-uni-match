"""Signup/login/logout, email verification, and password reset — all via a
6-digit OTP emailed through email_client. Session state is a JWT in an
httpOnly cookie (see deps.cookie_kwargs)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

import auth
import email_client
from deps import SESSION_COOKIE, cookie_kwargs, get_current_user_optional

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/auth", tags=["auth"])


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "is_verified": bool(user["is_verified"]),
        "avatar_seed": user["avatar_seed"],
    }


def _valid_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[-1] and len(email) <= 254


def _set_session_cookie(response: Response, user_id: int, role: str) -> None:
    token = auth.create_session_token(user_id, role)
    response.set_cookie(SESSION_COOKIE, token, **cookie_kwargs())


class SignupRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(payload: SignupRequest):
    email = payload.email.strip().lower()
    if not _valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if auth.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = auth.create_user(email, payload.password)
    code = auth.create_otp(user_id, "verify_email")
    try:
        email_client.send_otp_email(email, code, "verify_email")
    except Exception:
        logger.exception("Failed to send verification email to %s", email)
        raise HTTPException(
            status_code=503, detail="Account created, but the verification email failed to send. Try resending it."
        )
    return {"message": "Account created. Check your email for a verification code.", "email": email}


class VerifyOtpRequest(BaseModel):
    email: str
    code: str


@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest, response: Response):
    user = auth.get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if not user["is_verified"]:
        if not auth.verify_otp(user["id"], "verify_email", payload.code.strip()):
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        auth.set_user_verified(user["id"])
        user = auth.get_user_by_id(user["id"])

    _set_session_cookie(response, user["id"], user["role"])
    return {"user": _public_user(user)}


class ResendOtpRequest(BaseModel):
    email: str
    purpose: str = "verify_email"


@router.post("/resend-otp")
def resend_otp(payload: ResendOtpRequest):
    if payload.purpose not in ("verify_email", "reset_password"):
        raise HTTPException(status_code=400, detail="Invalid purpose")

    user = auth.get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email")

    wait = auth.seconds_until_resend_allowed(user["id"], payload.purpose)
    if wait > 0:
        raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code")

    code = auth.create_otp(user["id"], payload.purpose)
    try:
        email_client.send_otp_email(user["email"], code, payload.purpose)
    except Exception:
        logger.exception("Failed to resend %s email to %s", payload.purpose, user["email"])
        raise HTTPException(status_code=503, detail="Couldn't send the email right now — please try again shortly")
    return {"message": "A new code has been sent."}


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    user = auth.get_user_by_email(payload.email)
    if not user or not auth.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["is_verified"]:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in")

    _set_session_cookie(response, user["id"], user["role"])
    return {"user": _public_user(user)}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user=Depends(get_current_user_optional)):
    return {"user": _public_user(user) if user else None}


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    user = auth.get_user_by_email(payload.email)
    if user:
        wait = auth.seconds_until_resend_allowed(user["id"], "reset_password")
        if wait == 0:
            code = auth.create_otp(user["id"], "reset_password")
            try:
                email_client.send_otp_email(user["email"], code, "reset_password")
            except Exception:
                logger.exception("Failed to send password reset email to %s", user["email"])
    # Same response whether or not the account exists, so this can't be used
    # to discover registered emails.
    return {"message": "If an account exists for this email, a reset code has been sent."}


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = auth.get_user_by_email(payload.email)
    if not user or not auth.verify_otp(user["id"], "reset_password", payload.code.strip()):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    auth.set_user_password(user["id"], payload.new_password)
    return {"message": "Password updated. You can now log in."}
