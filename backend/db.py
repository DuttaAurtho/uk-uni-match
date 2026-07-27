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
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import libsql_client
from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).parent
DB_PATH = Path(os.environ.get("DATABASE_PATH", BACKEND_DIR / "universities.db"))
SEED_FILE = BACKEND_DIR / "universities_data.json"

# Columns holding JSON-encoded lists, decoded on read.
_JSON_COLUMNS = ("intakes", "courses", "levels")
# Columns holding a JSON object rather than a list — decoded the same way,
# but an empty/missing value has to become {} rather than [].
_JSON_OBJECT_COLUMNS = ("field_sources",)

# Degree levels a university is assumed to teach until an admin says otherwise.
# Nearly every UK institution runs both, so "both" is the only honest default;
# the postgraduate-only specialists are corrected by hand in the admin panel.
DEFAULT_LEVELS = ["BSc", "MSc"]


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
    # 4 — accounts, OTP verification, and the user dashboard/admin/chat
    # features built on top of them. One admin account (seeded via
    # scripts/create_admin.py) shares this same table via `role`.
    """
    CREATE TABLE users (
        id              INTEGER PRIMARY KEY,
        email           TEXT    NOT NULL UNIQUE,
        password_hash   TEXT    NOT NULL,
        role            TEXT    NOT NULL DEFAULT 'user',
        is_verified     INTEGER NOT NULL DEFAULT 0,
        avatar_seed     TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX idx_users_email ON users(email)",
    # 5 — OTP codes for email verification and password reset. Only the
    # SHA-256 hash of the code is stored; `attempts` caps brute force at the
    # application layer (see auth.py).
    """
    CREATE TABLE otp_codes (
        id           INTEGER PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code_hash    TEXT    NOT NULL,
        purpose      TEXT    NOT NULL,
        attempts     INTEGER NOT NULL DEFAULT 0,
        expires_at   TEXT    NOT NULL,
        consumed_at  TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX idx_otp_user_purpose ON otp_codes(user_id, purpose)",
    # 6 — one row per /universities search made while logged in.
    """
    CREATE TABLE search_history (
        id            INTEGER PRIMARY KEY,
        user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        gpa           REAL,
        ielts         REAL,
        budget        REAL,
        course        TEXT,
        city          TEXT,
        result_count  INTEGER,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX idx_history_user ON search_history(user_id)",
    # 7 — a user's favourited/whitelisted universities.
    """
    CREATE TABLE favorites (
        id             INTEGER PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        university_id  INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, university_id)
    )
    """,
    "CREATE INDEX idx_favorites_user ON favorites(user_id)",
    # 8 — a user's to-do list, optionally scoped to one university.
    """
    CREATE TABLE todos (
        id             INTEGER PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title          TEXT    NOT NULL,
        is_done        INTEGER NOT NULL DEFAULT 0,
        due_date       TEXT,
        university_id  INTEGER REFERENCES universities(id) ON DELETE SET NULL,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX idx_todos_user ON todos(user_id)",
    # 9 — per-user, per-university application document checklist.
    """
    CREATE TABLE university_requirements (
        id             INTEGER PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        university_id  INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
        document_name  TEXT    NOT NULL,
        is_ready       INTEGER NOT NULL DEFAULT 0,
        notes          TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX idx_requirements_user_uni ON university_requirements(user_id, university_id)",
    # 10 — one thread per user, mixing messages from both sides; `user_id`
    # always names the non-admin party in the thread.
    """
    CREATE TABLE chat_messages (
        id           INTEGER PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_role  TEXT    NOT NULL,
        body         TEXT    NOT NULL,
        read_at      TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX idx_chat_user ON chat_messages(user_id)",
    # 11 — a persisted official link (previously only shown for the
    # university a search happened to enrich live, never saved), plus a
    # timestamp so scripts/refresh_estimates.py can rotate through the
    # dataset oldest-refreshed-first instead of re-checking everything.
    "ALTER TABLE universities ADD COLUMN official_url TEXT",
    "ALTER TABLE universities ADD COLUMN estimated_last_synced TEXT",
    # Which degree levels each university teaches, so the BSc/MSc filter has
    # something real to match on. Existing rows take the default (both).
    """ALTER TABLE universities ADD COLUMN levels TEXT NOT NULL
       DEFAULT '["BSc", "MSc"]'""",
    # The three newer search filters, so a history entry describes the search
    # that was actually run rather than a subset of it.
    "ALTER TABLE search_history ADD COLUMN intake TEXT",
    "ALTER TABLE search_history ADD COLUMN level TEXT",
    "ALTER TABLE search_history ADD COLUMN name_query TEXT",
    # Tuition as a range. A single number per university cannot be right:
    # fees vary by course, level and year, so one figure is either the
    # cheapest course quoted as if it were all of them, or an average that
    # matches nothing. annual_tuition_gbp stays as the representative figure
    # (sorting, ranking, the existing UI) with the range shown alongside it.
    "ALTER TABLE universities ADD COLUMN tuition_min_gbp INTEGER",
    "ALTER TABLE universities ADD COLUMN tuition_max_gbp INTEGER",
    # Where each figure came from: {field: {url, quote, checked_at}}. One JSON
    # column rather than three columns per field, so covering a new field
    # later costs no migration. A field absent from here is an unverified
    # estimate, and the UI is expected to say so.
    "ALTER TABLE universities ADD COLUMN field_sources TEXT NOT NULL DEFAULT '{}'",
]


class _TursoCursor:
    """Mimics just enough of sqlite3's cursor surface (fetchone/fetchall/
    lastrowid/rowcount) for the rest of this codebase to not notice which
    backend it's talking to. Rows come back as plain dicts (via `Row.asdict`)
    rather than sqlite3.Row, but every call site already does `row["col"]` or
    `dict(row)`, both of which work identically on a plain dict."""

    def __init__(self, result_set: "libsql_client.ResultSet"):
        self._rows = [row.asdict() for row in result_set.rows]
        self._pos = 0
        self.lastrowid = result_set.last_insert_rowid
        self.rowcount = result_set.rows_affected

    def fetchone(self) -> Optional[Dict[str, Any]]:
        if self._pos >= len(self._rows):
            return None
        row = self._rows[self._pos]
        self._pos += 1
        return row

    def fetchall(self) -> List[Dict[str, Any]]:
        rest = self._rows[self._pos:]
        self._pos = len(self._rows)
        return rest


class _TursoConnection:
    """Thin wrapper around libsql_client's sync HTTP client so db.py/auth.py/
    dashboard_db.py can keep using the exact same `conn.execute(...)`,
    `conn.commit()`, `conn.close()` calls they use against local sqlite3.
    Each statement is committed by Turso as it runs (no local transaction
    buffering here), so `commit()` is a no-op kept only for API compatibility.

    Wraps the single process-wide client from `_get_turso_client()` rather
    than opening its own — `create_client_sync` spins up a background
    asyncio thread per client, and this app calls `db.connect()` once or
    more per request, so a fresh client per call quickly piles up
    concurrent event-loop threads and starts hanging under load. `close()`
    is a no-op here too, since the shared client outlives any one request."""

    def __init__(self, client: "libsql_client.SyncClient"):
        self._client = client

    def execute(self, sql: str, params=()) -> _TursoCursor:
        return _TursoCursor(self._client.execute(sql, list(params)))

    def commit(self) -> None:
        pass

    def close(self) -> None:
        pass


_turso_client = None
_turso_client_lock = threading.Lock()


def _get_turso_client(url: str, auth_token: str) -> "libsql_client.SyncClient":
    global _turso_client
    if _turso_client is None:
        with _turso_client_lock:
            if _turso_client is None:
                # libsql:// is a websocket scheme; some sandboxed/proxied
                # networks block the websocket upgrade (seen in this repo's
                # own dev environment), and the HTTP-based Hrana protocol
                # behind https:// works identically for everything here.
                http_url = url.replace("libsql://", "https://", 1)
                _turso_client = libsql_client.create_client_sync(url=http_url, auth_token=auth_token)
    return _turso_client


def shutdown() -> None:
    """Close the shared Turso client's background thread. The FastAPI
    server never needs this — its process lifetime is the client's lifetime
    — but standalone scripts (create_admin.py, sync_discover_uni.py) must
    call this before exiting, or that non-daemon thread keeps the process
    alive indefinitely even after the script's own work is done."""
    global _turso_client
    if _turso_client is not None:
        _turso_client.close()
        _turso_client = None


def connect():
    """A local sqlite3 file by default; a remote Turso database if
    TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are set (see .env.example) — that's
    how the production deploy gets a database that survives redeploys on a
    host with an ephemeral filesystem, without local dev needing an account."""
    turso_url = os.environ.get("TURSO_DATABASE_URL")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN")
    if turso_url and turso_token:
        client = _get_turso_client(turso_url, turso_token)
        conn = _TursoConnection(client)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

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
                     scholarship, intakes, courses, levels, data_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                -- `levels` is deliberately absent below: the seed file carries
                -- no per-university level data, so re-seeding must not undo an
                -- admin's correction (e.g. marking an institution MSc-only).
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
                    json.dumps(uni.get("levels") or DEFAULT_LEVELS),
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
    for column in _JSON_OBJECT_COLUMNS:
        uni[column] = json.loads(uni[column]) if uni.get(column) else {}
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


# Fields the admin panel may write. `ukprn` and the `official_*` columns are
# intentionally excluded — those are only ever set by scripts/sync_discover_uni.py.
_EDITABLE_UNIVERSITY_FIELDS = (
    "name", "city", "min_gpa", "min_ielts", "annual_tuition_gbp",
    "scholarship", "intakes", "courses", "levels", "data_status", "official_url",
    "tuition_min_gbp", "tuition_max_gbp", "field_sources",
)


def _encode_university_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
    encoded = {k: v for k, v in fields.items() if k in _EDITABLE_UNIVERSITY_FIELDS}
    for column in _JSON_COLUMNS:
        if column in encoded:
            encoded[column] = json.dumps(encoded[column] or [])
    for column in _JSON_OBJECT_COLUMNS:
        if column in encoded:
            encoded[column] = json.dumps(encoded[column] or {})
    return encoded


def insert_university(fields: Dict[str, Any], conn: Optional[sqlite3.Connection] = None) -> int:
    """Create a new university row. Returns the new id."""
    own = conn is None
    conn = conn or connect()
    try:
        data = _encode_university_fields(fields)
        columns = list(data.keys())
        placeholders = ", ".join("?" for _ in columns)
        cur = conn.execute(
            f"INSERT INTO universities ({', '.join(columns)}) VALUES ({placeholders})",
            [data[c] for c in columns],
        )
        conn.commit()
        return cur.lastrowid
    finally:
        if own:
            conn.close()


def update_university(
    uni_id: int, fields: Dict[str, Any], conn: Optional[sqlite3.Connection] = None
) -> bool:
    """Patch an existing university row. Returns False if no row matched."""
    own = conn is None
    conn = conn or connect()
    try:
        data = _encode_university_fields(fields)
        if not data:
            return False
        set_clause = ", ".join(f"{c} = ?" for c in data)
        cur = conn.execute(
            f"UPDATE universities SET {set_clause} WHERE id = ?",
            [*data.values(), uni_id],
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


def delete_university(uni_id: int, conn: Optional[sqlite3.Connection] = None) -> bool:
    own = conn is None
    conn = conn or connect()
    try:
        cur = conn.execute("DELETE FROM universities WHERE id = ?", (uni_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        if own:
            conn.close()


# The dataset list handed out by init(). main.py holds this same list object
# as its module-level `UNIVERSITIES`; refresh() mutates it in place so that
# reference sees admin CRUD writes immediately, with no import back into main.
_cache: List[Dict[str, Any]] = []


def refresh(conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
    """Reload every university from disk into the shared cache, in place."""
    _cache[:] = load_universities(conn)
    return _cache


def init() -> List[Dict[str, Any]]:
    """Migrate, seed if empty, and return the shared cached dataset. Safe to
    call at import."""
    conn = connect()
    try:
        migrate(conn)
        count = conn.execute("SELECT COUNT(*) AS n FROM universities").fetchone()["n"]
        if count == 0:
            seed_from_json(conn)
        return refresh(conn)
    finally:
        conn.close()
