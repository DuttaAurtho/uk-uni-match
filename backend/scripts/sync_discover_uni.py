"""Sync official Discover Uni (HESA/OfS) statistics into the local database.

Free, official UK government data. No paid API, no AI service.

    python scripts/sync_discover_uni.py --inspect  <zip>   # show real structure
    python scripts/sync_discover_uni.py --dry-run  <zip>   # parse + match only
    python scripts/sync_discover_uni.py            <zip>   # write to the DB

Why the zip is a required argument
----------------------------------
hesa.ac.uk returns HTTP 403 to scripted requests — every path, including
robots.txt, with or without a browser user-agent. So this cannot download the
dataset itself. Fetch it once from a browser:

    https://www.hesa.ac.uk/support/tools-and-downloads/unistats

and pass the path. `--check-source` reports whether the block still applies
from wherever you're running.

Why files and columns are resolved at runtime
---------------------------------------------
Because HESA blocks automated access, the published file-structure document
could not be read while writing this. Rather than hard-code column names that
might be wrong, each field below lists candidate names, resolved
case-insensitively against the actual zip. If a required field can't be
resolved the script stops and prints exactly what the file does contain, so
you can correct the mapping in one place instead of debugging a KeyError.
Run --inspect first; it prints real headers and writes nothing.

Discover Uni does NOT publish international tuition fees or IELTS
requirements. Those stay estimates and are never touched here.
"""

import argparse
import csv
import io
import json
import logging
import re
import sqlite3
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db  # noqa: E402

log = logging.getLogger("sync_discover_uni")

SOURCE_PAGE = "https://www.hesa.ac.uk/support/tools-and-downloads/unistats"

# --- Structure mapping ------------------------------------------------------
# Filenames are matched on stem, case-insensitively. Columns likewise. Order is
# preference order. Extend these rather than editing parsing code.

FILE_CANDIDATES: Dict[str, Sequence[str]] = {
    "institution": ("INSTITUTION",),
    "nss": ("NSS", "NSSRESULT", "NSSAGG"),
    "employment": ("GO", "GOVOICE", "EMPLOYMENT", "GRADUATEOUTCOMES"),
    "salary": ("LEO3", "SALARY", "GOSALARY", "LEO5"),
    "continuation": ("CONTINUATION", "CONT"),
}

# Only `institution` is required — the app still gains value from a partial
# import, and a missing statistic is reported rather than fatal.
REQUIRED_FILES = ("institution",)

UKPRN_COLUMNS = ("UKPRN", "PUBUKPRN", "INSTITUTION_UKPRN")

COLUMN_CANDIDATES: Dict[str, Sequence[str]] = {
    "institution_name": ("LEGAL_NAME", "LEGALNAME", "NAME", "PROVIDERNAME", "INSTITUTION_NAME"),
    "nss_satisfaction": ("NSSAGGREGATE", "NSSOVERALL", "Q27", "Q26", "NSSSATISFACTION", "AGG"),
    "employment_pct": ("WORKSTUDY", "EMPLOYED", "GOWORKSTUDY", "EMPLOYMENTRATE", "INWORKORSTUDY"),
    "median_salary": ("LEOMEDIAN", "MEDIAN", "SALARYMEDIAN", "GOMEDIAN", "MED"),
    "continuation_pct": ("UCONT", "CONTINUING", "CONTINUATIONRATE", "CONT"),
}


# --- Name matching ----------------------------------------------------------

_STOPWORDS = {"the", "of", "and"}


def normalise(name: str) -> str:
    """Loose key for matching provider names across sources: drops
    parentheticals, punctuation, apostrophes, and filler words."""
    name = re.sub(r"\(.*?\)", " ", name or "")
    name = name.replace("'", "").replace("’", "")
    words = re.sub(r"[^a-z0-9]+", " ", name.lower()).split()
    return " ".join(w for w in words if w not in _STOPWORDS)


# Words that carry no distinguishing information between providers — every
# other institution has one. "University of London" must not match "University
# of West London" on the strength of the word "university".
_GENERIC = {"university", "college", "institute", "school", "at", "in"}

# Known legal-vs-trading name drift, verified against the gov.uk register of
# licensed student sponsors. Fuzzy matching deliberately refuses these: the
# official name for Northumbria contains "Newcastle", which is also one of our
# universities, so guessing would risk joining the wrong provider's statistics.
# An explicit, auditable entry is safer than a cleverer heuristic.
NAME_ALIASES = {
    "university of northumbria at newcastle": "Northumbria University",
    "university of hertfordshire higher education corporation": "University of Hertfordshire",
    "southampton solent university": "Solent University",
    "university of the west of england": "University of the West of England, Bristol",
}


# The institution-type word is not distinctive *between* universities, but it
# does separate a university from a same-named FE college — "Newcastle College"
# is not "Newcastle University". Tracked separately from the distinctive tokens.
_TYPE_WORDS = {"university", "college", "institute", "school", "conservatoire", "academy"}


def _distinctive(key: str) -> frozenset:
    return frozenset(key.split()) - _GENERIC


def _types(key: str) -> frozenset:
    return frozenset(key.split()) & _TYPE_WORDS


def build_index(names: Sequence[str]) -> dict:
    """Index our university names for matching, including how often each
    distinctive token occurs. A token used by only one of our universities
    ("hertfordshire") identifies it; a shared one ("london") does not."""
    by_key = {normalise(n): n for n in names}
    frequency: Dict[str, int] = defaultdict(int)
    for key in by_key:
        for token in _distinctive(key):
            frequency[token] += 1
    aliases = {normalise(official): ours for official, ours in NAME_ALIASES.items()}
    return {"by_key": by_key, "frequency": dict(frequency), "aliases": aliases}


def match_name(official: str, index: dict) -> Optional[str]:
    """Resolve an official provider name to one of our university names.

    Three passes, most trustworthy first:
      1. exact match on the normalised name;
      2. an explicit alias, for known legal-vs-trading drift;
      3. a token-set match — but only when the overlap contains a token unique
         to one of our universities, and only when exactly one candidate
         qualifies.

    Pass 3's rarity requirement is what stops "London College of Fashion"
    binding to "University College London": they share only `london`, which a
    dozen of our universities also use. An unmatched provider is reported in
    the summary; a wrongly matched one would silently corrupt a record, so
    this errs toward reporting.
    """
    key = normalise(official)
    if not key:
        return None

    by_key = index["by_key"]
    if key in by_key:
        return by_key[key]
    # Alias keys are normalised on the way in, so they survive the same
    # stopword stripping the incoming name went through.
    if key in index["aliases"]:
        return index["aliases"][key]

    tokens = _distinctive(key)
    if not tokens:
        return None
    frequency = index["frequency"]
    official_types = _types(key)
    hits = set()
    for ours_key, ours_name in by_key.items():
        ours_tokens = _distinctive(ours_key)
        if not ours_tokens or not (ours_tokens <= tokens or tokens <= ours_tokens):
            continue
        # Both name a type and they disagree — a college is not the university
        # of the same name. Without this, "Newcastle College" binds to
        # "Newcastle University", since the type word is the only difference.
        ours_types = _types(ours_key)
        if official_types and ours_types and not (official_types & ours_types):
            continue
        shared = ours_tokens & tokens
        if any(frequency.get(t, 0) == 1 for t in shared):
            hits.add(ours_name)
    return next(iter(hits)) if len(hits) == 1 else None


# --- Zip reading ------------------------------------------------------------


def _csv_members(zf: zipfile.ZipFile) -> Dict[str, str]:
    """Map uppercase stem -> member path for every CSV in the archive."""
    out = {}
    for member in zf.namelist():
        if member.lower().endswith(".csv"):
            out[Path(member).stem.upper()] = member
    return out


def _read_csv(zf: zipfile.ZipFile, member: str) -> List[dict]:
    raw = zf.read(member)
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", "ignore")
    return list(csv.DictReader(io.StringIO(text)))


def resolve_file(members: Dict[str, str], role: str) -> Optional[str]:
    for candidate in FILE_CANDIDATES[role]:
        if candidate.upper() in members:
            return members[candidate.upper()]
    return None


def resolve_column(fieldnames: Sequence[str], candidates: Sequence[str]) -> Optional[str]:
    lookup = {re.sub(r"[^a-z0-9]", "", f.lower()): f for f in fieldnames}
    for candidate in candidates:
        key = re.sub(r"[^a-z0-9]", "", candidate.lower())
        if key in lookup:
            return lookup[key]
    return None


def _to_number(value) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip().replace(",", "").replace("£", "").rstrip("%")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None  # suppression markers ("N/A", "DP", "*") are not errors


# --- Commands ---------------------------------------------------------------


def inspect(zip_path: Path) -> int:
    """Print what the archive actually contains. Writes nothing."""
    with zipfile.ZipFile(zip_path) as zf:
        members = _csv_members(zf)
        others = [m for m in zf.namelist() if not m.lower().endswith(".csv")]

        print(f"\n{zip_path.name} — {len(members)} CSV files, {len(others)} other\n")
        for other in others[:10]:
            print(f"  (non-CSV) {other}")
        print()

        for stem in sorted(members):
            rows = _read_csv(zf, members[stem])
            cols = list(rows[0].keys()) if rows else []
            print(f"  {stem:24} {len(rows):>8,} rows  {len(cols):>3} cols")
            if cols:
                print(f"      {', '.join(cols[:14])}{' …' if len(cols) > 14 else ''}")

        print("\n  Mapping resolution against this archive:")
        for role in FILE_CANDIDATES:
            member = resolve_file(members, role)
            if not member:
                flag = "REQUIRED" if role in REQUIRED_FILES else "optional"
                print(f"    {role:14} NOT FOUND  ({flag}; tried {', '.join(FILE_CANDIDATES[role])})")
                continue
            rows = _read_csv(zf, member)
            fields = list(rows[0].keys()) if rows else []
            ukprn = resolve_column(fields, UKPRN_COLUMNS)
            print(f"    {role:14} {Path(member).name:20} ukprn={ukprn or 'UNRESOLVED'}")
            for field, candidates in COLUMN_CANDIDATES.items():
                if role in field or (role == "institution" and field == "institution_name"):
                    print(f"        {field:20} -> {resolve_column(fields, candidates) or 'UNRESOLVED'}")
    return 0


def collect(zip_path: Path) -> Dict[str, dict]:
    """Parse the archive into per-UKPRN aggregates."""
    stats: Dict[str, dict] = defaultdict(
        lambda: {"name": None, "nss": [], "employment": [], "salary": [], "continuation": [], "courses": 0}
    )

    with zipfile.ZipFile(zip_path) as zf:
        members = _csv_members(zf)

        missing = [r for r in REQUIRED_FILES if not resolve_file(members, r)]
        if missing:
            raise SystemExit(
                f"Required file(s) not found: {', '.join(missing)}.\n"
                f"Archive contains: {', '.join(sorted(members)) or '(no CSVs)'}\n"
                f"Run with --inspect to see the full structure, then extend "
                f"FILE_CANDIDATES in this script."
            )

        # Institutions -> canonical names.
        member = resolve_file(members, "institution")
        rows = _read_csv(zf, member)
        fields = list(rows[0].keys()) if rows else []
        ukprn_col = resolve_column(fields, UKPRN_COLUMNS)
        name_col = resolve_column(fields, COLUMN_CANDIDATES["institution_name"])
        if not ukprn_col or not name_col:
            raise SystemExit(
                f"Could not resolve UKPRN/name columns in {Path(member).name}.\n"
                f"Columns present: {', '.join(fields)}\n"
                f"Extend UKPRN_COLUMNS / COLUMN_CANDIDATES['institution_name']."
            )
        for row in rows:
            ukprn = (row.get(ukprn_col) or "").strip()
            if ukprn:
                stats[ukprn]["name"] = (row.get(name_col) or "").strip()
        log.info("institutions: %s providers from %s", len(stats), Path(member).name)

        # Per-course statistics, averaged per provider.
        for role, bucket, field in (
            ("nss", "nss", "nss_satisfaction"),
            ("employment", "employment", "employment_pct"),
            ("salary", "salary", "median_salary"),
            ("continuation", "continuation", "continuation_pct"),
        ):
            member = resolve_file(members, role)
            if not member:
                log.warning("%s: no matching file — that statistic will be null", role)
                continue
            rows = _read_csv(zf, member)
            fields = list(rows[0].keys()) if rows else []
            ukprn_col = resolve_column(fields, UKPRN_COLUMNS)
            value_col = resolve_column(fields, COLUMN_CANDIDATES[field])
            if not ukprn_col or not value_col:
                log.warning(
                    "%s: could not resolve columns in %s (ukprn=%s, value=%s). "
                    "Columns present: %s",
                    role, Path(member).name, ukprn_col, value_col, ", ".join(fields[:20]),
                )
                continue
            kept = 0
            for row in rows:
                ukprn = (row.get(ukprn_col) or "").strip()
                value = _to_number(row.get(value_col))
                if ukprn and value is not None:
                    stats[ukprn][bucket].append(value)
                    kept += 1
                if role == "nss" and ukprn:
                    stats[ukprn]["courses"] += 1
            log.info("%s: %s usable values from %s (%s)", role, kept, Path(member).name, value_col)

    return dict(stats)


def _mean(values: List[float]) -> Optional[float]:
    return round(sum(values) / len(values), 1) if values else None


def sync(zip_path: Path, dry_run: bool = False) -> int:
    stats = collect(zip_path)

    conn = db.connect()
    try:
        db.migrate(conn)
        ours = conn.execute("SELECT id, name FROM universities").fetchall()
        index = build_index([r["name"] for r in ours])

        synced_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        source = f"Discover Uni (HESA/OfS) — {zip_path.name}"

        updated, no_data, unmatched = 0, 0, []
        matched_ours = set()

        for ukprn, s in stats.items():
            official_name = s["name"]
            if not official_name:
                continue
            ours_name = match_name(official_name, index)
            if not ours_name:
                unmatched.append(official_name)
                continue
            matched_ours.add(ours_name)

            nss = _mean(s["nss"])
            emp = _mean(s["employment"])
            sal = _mean(s["salary"])
            cont = _mean(s["continuation"])
            if all(v is None for v in (nss, emp, sal, cont)):
                no_data += 1
                continue

            if not dry_run:
                conn.execute(
                    """
                    UPDATE universities SET
                        ukprn                      = ?,
                        official_nss_satisfaction  = ?,
                        official_employment_pct    = ?,
                        official_median_salary_gbp = ?,
                        official_continuation_pct  = ?,
                        official_course_count      = ?,
                        official_source            = ?,
                        official_last_synced       = ?
                    WHERE name = ?
                    """,
                    (ukprn, nss, emp, int(sal) if sal is not None else None, cont,
                     s["courses"] or None, source, synced_at, ours_name),
                )
            updated += 1

        if not dry_run:
            conn.commit()

        ours_names = {r["name"] for r in ours}
        never_matched = sorted(ours_names - matched_ours)

        print()
        print("=" * 62)
        print(f"  Discover Uni sync{'  (DRY RUN — nothing written)' if dry_run else ''}")
        print("=" * 62)
        print(f"  source archive        : {zip_path.name}")
        print(f"  providers in dataset  : {len(stats):,}")
        print(f"  universities updated  : {updated}")
        print(f"  matched but no stats  : {no_data}")
        print(f"  ours with no match    : {len(never_matched)} / {len(ours_names)}")
        print(f"  dataset rows unmatched: {len(unmatched):,} (mostly FE colleges, expected)")
        if never_matched:
            print("\n  Not matched to official data — check these for name drift:")
            for name in never_matched[:25]:
                print(f"    - {name}")
            if len(never_matched) > 25:
                print(f"    … and {len(never_matched) - 25} more")
        print("=" * 62)
        return 0
    finally:
        conn.close()


def check_source() -> int:
    """Report whether HESA is reachable from here."""
    import urllib.request

    req = urllib.request.Request(
        SOURCE_PAGE,
        headers={"User-Agent": "Mozilla/5.0 (compatible; uk-uni-match dataset sync)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"[{r.status}] reachable — automated download may be possible from here.")
    except Exception as exc:
        print(f"[blocked] {type(exc).__name__}: {exc}")
        print(f"Download manually in a browser: {SOURCE_PAGE}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("zip", nargs="?", type=Path, help="Path to the Discover Uni zip")
    parser.add_argument("--inspect", action="store_true", help="Print the archive's real structure and exit")
    parser.add_argument("--dry-run", action="store_true", help="Parse and match without writing")
    parser.add_argument("--check-source", action="store_true", help="Test whether HESA is reachable")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="  %(levelname)-7s %(message)s")

    if args.check_source:
        return check_source()
    if not args.zip:
        parser.error("a zip path is required (or use --check-source)")
    if not args.zip.exists():
        parser.error(f"file not found: {args.zip}\nDownload it from {SOURCE_PAGE}")

    return inspect(args.zip) if args.inspect else sync(args.zip, dry_run=args.dry_run)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    finally:
        db.shutdown()
