"""SQLite storage for the university dataset.

Replaces the previous single-JSON-file store. `universities_data.json` is now
the *seed* for our own estimated figures, not the live store — official
statistics arrive separately via scripts/sync_discover_uni.py.

Two classes of field live side by side and are deliberately kept distinct:

  estimated_*  — our own figures (tuition, IELTS, GPA). Discover Uni does not
                 publish international fees or English-language requirements,
                 so these stay estimates and must never be presented as
                 verified.
  official_*   — Discover Uni (HESA/OfS) statistics. Real government data,
                 stamped with official_last_synced.

Migrations are plain numbered steps in MIGRATIONS; each runs once, tracked in
schema_version. Nothing else in the app needs an ORM for a table this size.
"""

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

BACKEND_DIR = Path(__file__).parent
DB_PATH = Path(os.environ.get("DATABASE_PATH", BACKEND_DIR / "universities.db"))
SEED_FILE = BACKEND_DIR / "universities_data.json"

# Columns holding JSON-encoded lists, decoded on read.
_JSON_COLUMNS = ("intakes", "courses")


# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------

MIGRATIONS = [
    # 1 — initial schema.
    """
    CREATE TABLE universities (
        id                      INTEGER PRIMARY KEY,
        -- Official UK provider identifier. NULL until the sync matches this
        -- row; once set it is the stable join key (our `id` renumbers
        -- whenever the seed file is regenerated, so it is not a stable key).
        ukprn                   TEXT    UNIQUE,
        name                    TEXT    NOT NULL UNIQUE,
        city                    TEXT    NOT NULL,

        -- Our own estimates. Not from Discover Uni.
        min_gpa                 REAL,
        min_ielts               REAL,
        annual_tuition_gbp      INTEGER,
        scholarship             TEXT,
        intakes                 TEXT    NOT NULL DEFAULT '[]',
        courses                 TEXT    NOT NULL DEFAULT '[]',
        data_status             TEXT,

        -- Discover Uni aggregates (see sync_discover_uni.py).
        official_nss_satisfaction   REAL,
        official_employment_pct     REAL,
        official_median_salary_gbp  INTEGER,
        official_continuation_pct   REAL,
        official_course_count       INTEGER,
        official_source             TEXT,
        official_last_synced        TEXT
    )
    """,
    "CREATE INDEX idx_universities_name ON universities(name)",
    "CREATE INDEX idx_universities_ukprn ON universities(ukprn)",
]


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _current_version(conn: sqlite3.Connection) -> int:
    conn.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
    row = conn.execute("SELECT MAX(version) AS v FROM schema_version").fetchone()
    return row["v"] or 0


def migrate(conn: Optional[sqlite3.Connection] = None) -> int:
    """Apply any migrations this database hasn't seen. Returns how many ran."""
    own = conn is None
    conn = conn or connect()
    try:
        version = _current_version(conn)
        applied = 0
        for i, statement in enumerate(MIGRATIONS, start=1):
            if i <= version:
                continue
            conn.execute(statement)
            conn.execute("INSERT INTO schema_version (version) VALUES (?)", (i,))
            applied += 1
        conn.commit()
        return applied
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------------------
# Seeding and reading
# ---------------------------------------------------------------------------


def seed_from_json(conn: Optional[sqlite3.Connection] = None) -> int:
    """Load our estimated dataset from the seed JSON. Idempotent: matches on
    name and leaves any official_* columns untouched, so re-seeding after a
    sync never clobbers real government data."""
    own = conn is None
    conn = conn or connect()
    try:
        records = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        for uni in records:
            conn.execute(
                """
                INSERT INTO universities
                    (name, city, min_gpa, min_ielts, annual_tuition_gbp,
                     scholarship, intakes, courses, data_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    city               = excluded.city,
                    min_gpa            = excluded.min_gpa,
                    min_ielts          = excluded.min_ielts,
                    annual_tuition_gbp = excluded.annual_tuition_gbp,
                    scholarship        = excluded.scholarship,
                    intakes            = excluded.intakes,
                    courses            = excluded.courses,
                    data_status        = excluded.data_status
                """,
                (
                    uni["name"],
                    uni["city"],
                    uni.get("min_gpa"),
                    uni.get("min_ielts"),
                    uni.get("annual_tuition_gbp"),
                    uni.get("scholarship", ""),
                    json.dumps(uni.get("intakes", [])),
                    json.dumps(uni.get("courses", [])),
                    uni.get("data_status", "Estimated - please verify"),
                ),
            )
        conn.commit()
        return len(records)
    finally:
        if own:
            conn.close()


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    uni = dict(row)
    for column in _JSON_COLUMNS:
        uni[column] = json.loads(uni[column]) if uni.get(column) else []
    return uni


def load_universities(conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    """Every university, shaped like the old JSON records so existing callers
    keep working, plus the official_* fields."""
    own = conn is None
    conn = conn or connect()
    try:
        rows = conn.execute("SELECT * FROM universities ORDER BY name").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        if own:
            conn.close()


def init() -> List[Dict[str, Any]]:
    """Migrate, seed if empty, and return the dataset. Safe to call at import."""
    conn = connect()
    try:
        migrate(conn)
        count = conn.execute("SELECT COUNT(*) AS n FROM universities").fetchone()["n"]
        if count == 0:
            seed_from_json(conn)
        return load_universities(conn)
    finally:
        conn.close()
