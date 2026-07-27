"""Seed (or reset the password of) the single admin account.

    python scripts/create_admin.py
    python scripts/create_admin.py --email you@example.com --password "..."

With no flags, reads ADMIN_EMAIL/ADMIN_PASSWORD from backend/.env. Safe to
re-run: an existing account with this email is switched to role='admin'
(verified, password reset) rather than duplicated. The password is always
bcrypt-hashed before it touches the database — nothing here ever stores or
prints it back.
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth  # noqa: E402
import db  # noqa: E402


def main() -> int:
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")

    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD"))
    args = parser.parse_args()

    if not args.email or not args.password:
        parser.error("Email and password are required (via flags or ADMIN_EMAIL/ADMIN_PASSWORD in .env)")
    if len(args.password) < 8:
        parser.error("Password must be at least 8 characters")

    try:
        db.migrate()
        user_id = auth.upsert_admin(args.email.strip().lower(), args.password)
        print(f"Admin account ready: {args.email} (user id {user_id})")
        return 0
    finally:
        db.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
