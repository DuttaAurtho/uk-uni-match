"""OTP delivery over SMTP.

Gmail (with an App Password, not the account password) is the default
provider for this project — see .env.example. Raises on failure like
gemini_client does; the caller (routes_auth.py) decides the fallback.
"""

import os
import smtplib
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
    host, port, user, password = _smtp_config()
    intro = _INTROS.get(purpose, "Use this code to continue:")

    message = MIMEMultipart("alternative")
    message["Subject"] = _SUBJECTS.get(purpose, "Your UK Uni Match verification code")
    message["From"] = f"UK Uni Match <{user}>"
    message["To"] = to
    message.attach(MIMEText(f"{intro}\n\n{code}\n\nThis code expires in 10 minutes.", "plain"))
    message.attach(MIMEText(_render_html(purpose, code), "html"))

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(user, to, message.as_string())
