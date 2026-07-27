"""OTP delivery, over an HTTPS mail API where one is configured, else SMTP.

Three transports, chosen by which credentials are present: Brevo, then
Resend, then SMTP. The order is not arbitrary —

  Brevo   verifies a single sender address by emailing you a link, so a plain
          Gmail address can send to anyone. No domain required.
  Resend  only delivers to your own account address until you verify a whole
          domain over DNS, so real users cannot be reached without one.
  SMTP    works locally but is blocked outbound by many hosts (Render's free
          tier included), where it fails exactly like a bad password.

Raises on failure like gemini_client does; the caller (routes_auth.py)
decides what the user sees.
"""

import json
import os
import smtplib
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

_SUBJECTS = {
    "verify_email": "Verify your UK Uni Match account",
    "reset_password": "Reset your UK Uni Match password",
}
_INTROS = {
    "verify_email": "Welcome! Use the code below to verify your email address and activate your account.",
    "reset_password": "We got a request to reset your password. Use the code below to continue.",
}
_HEADINGS = {
    "verify_email": "Verify your email",
    "reset_password": "Reset your password",
}

# Brand colors, matching frontend/app/globals.css.
_NAVY = "#16233F"
_NAVY_LIGHT = "#24365C"
_GOLD = "#C9A227"
_TEXT_SECONDARY = "#57617A"
_TEXT_MUTED = "#8991A6"
_BORDER = "#E2E5EC"
_BACKGROUND = "#F4F5F8"


def _smtp_config():
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    if not (host and user and password):
        raise RuntimeError("SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set")
    port = int(os.environ.get("SMTP_PORT", "587"))
    return host, port, user, password


# A blocked SMTP port doesn't refuse the connection, it swallows it — without
# a timeout the signup request hangs until the platform kills it.
SMTP_TIMEOUT_SECONDS = 20


def describe_backend() -> dict:
    """Which way mail will actually go out, without revealing credentials.

    Reported at startup and on GET / because a mis-set mail config is
    invisible from outside until a user tries to sign up and gets stuck
    with no way to verify."""
    if os.environ.get("BREVO_API_KEY"):
        return {"email": "brevo", "configured": True}
    if os.environ.get("RESEND_API_KEY"):
        return {"email": "resend", "configured": True}
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    if host and user and password:
        return {"email": "smtp", "configured": True, "host": host}
    return {"email": "unconfigured", "configured": False}


def _sender() -> tuple:
    """(name, address) mail is sent as."""
    raw = os.environ.get("EMAIL_FROM") or os.environ.get("SMTP_USER") or ""
    if "<" in raw and ">" in raw:
        name, address = raw.split("<", 1)
        return name.strip() or "UK Uni Match", address.rstrip(">").strip()
    return "UK Uni Match", raw.strip()


def _send_via_brevo(to: str, subject: str, text: str, html: str) -> None:
    """Send over Brevo's HTTPS API.

    Preferred over Resend when both are set, for one practical reason: Resend
    will only deliver to your own account address until you have verified a
    whole domain via DNS, which means real users cannot receive a signup code
    until you own a domain. Brevo verifies a single sender address by
    emailing you a link, so a Gmail address can send to anyone within
    minutes. Both are HTTPS, so neither is affected by hosts that block SMTP
    ports.
    """
    name, address = _sender()
    if not address:
        raise RuntimeError("EMAIL_FROM (or SMTP_USER) must name the sender address verified with Brevo")

    payload = json.dumps(
        {
            "sender": {"name": name, "email": address},
            "to": [{"email": to}],
            "subject": subject,
            "textContent": text,
            "htmlContent": html,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        headers={
            "api-key": os.environ["BREVO_API_KEY"],
            "content-type": "application/json",
            "accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:300]
        raise RuntimeError(f"Brevo rejected the message ({exc.code}): {detail}") from exc


def _send_via_resend(to: str, subject: str, text: str, html: str) -> None:
    """Send over Resend's HTTPS API.

    This exists because many hosting platforms — Render's free tier among
    them — block outbound SMTP ports to stop spam. Credentials that work
    perfectly from a laptop then fail on the deployed backend, which is
    indistinguishable from a wrong password unless you know to look for it.
    An HTTPS API is not blocked anywhere, so it works on any host.
    """
    api_key = os.environ["RESEND_API_KEY"]
    # Resend only accepts a From on a domain you've verified; their shared
    # onboarding sender works immediately and is the sane default until a
    # domain is set up.
    sender = os.environ.get("EMAIL_FROM", "UK Uni Match <onboarding@resend.dev>")
    payload = json.dumps(
        {"from": sender, "to": [to], "subject": subject, "text": text, "html": html}
    ).encode("utf-8")

    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:300]
        raise RuntimeError(f"Resend rejected the message ({exc.code}): {detail}") from exc


def _send_via_smtp(to: str, subject: str, text: str, html: str) -> None:
    host, port, user, password = _smtp_config()
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = os.environ.get("EMAIL_FROM") or f"UK Uni Match <{user}>"
    message["To"] = to
    message.attach(MIMEText(text, "plain"))
    message.attach(MIMEText(html, "html"))

    with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(user, to, message.as_string())


def _render_html(purpose: str, code: str) -> str:
    """A table-based layout (not flexbox/grid) since that's what actually
    renders consistently across Gmail, Outlook, and Apple Mail."""
    heading = _HEADINGS.get(purpose, "Your verification code")
    intro = _INTROS.get(purpose, "Use this code to continue:")
    spaced_code = " ".join(code)  # "123456" -> "1 2 3 4 5 6", easier to read and to avoid autolinking

    return f"""\
<!doctype html>
<html>
<body style="margin:0;padding:0;background:{_BACKGROUND};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BACKGROUND};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(22,35,63,0.08);">
          <tr>
            <td style="background:{_NAVY};padding:28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(201,162,39,0.15);border:1px solid rgba(201,162,39,0.3);border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle;font-size:16px;">&#127891;</td>
                  <td style="padding-left:10px;color:#FFFFFF;font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:0.3px;">UK Uni Match</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 8px;">
              <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:{_NAVY};">{heading}</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:{_TEXT_SECONDARY};">{intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BACKGROUND};border:1px solid {_BORDER};border-radius:10px;">
                <tr>
                  <td align="center" style="padding:20px;">
                    <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:{_NAVY};">{spaced_code}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:{_TEXT_MUTED};">
                This code expires in 10 minutes. If you didn't request this, you can safely ignore this email &mdash; your account is still secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;border-top:1px solid {_BORDER};">
              <p style="margin:0;font-size:12px;color:{_TEXT_MUTED};">UK Uni Match &middot; Find the UK university that actually fits you.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_otp_email(to: str, code: str, purpose: str) -> None:
    """Deliver a one-time code. Raises on failure; routes_auth decides what
    the user sees. Resend is preferred when configured because it survives
    hosts that block SMTP; otherwise this falls back to SMTP."""
    intro = _INTROS.get(purpose, "Use this code to continue:")
    subject = _SUBJECTS.get(purpose, "Your UK Uni Match verification code")
    text = f"{intro}\n\n{code}\n\nThis code expires in 10 minutes."
    html = _render_html(purpose, code)

    if os.environ.get("BREVO_API_KEY"):
        _send_via_brevo(to, subject, text, html)
        return
    if os.environ.get("RESEND_API_KEY"):
        _send_via_resend(to, subject, text, html)
        return
    _send_via_smtp(to, subject, text, html)
