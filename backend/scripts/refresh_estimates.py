"""Refresh estimated tuition/IELTS/scholarship figures via live web search +
Gemini, a batch at a time, oldest-refreshed-first.

    python scripts/refresh_estimates.py                  # next 20, oldest first
    python scripts/refresh_estimates.py --batch-size 40
    python scripts/refresh_estimates.py --dry-run
    python scripts/refresh_estimates.py --name "University of East London"

Free (DuckDuckGo search has no API key; Gemini's free tier is what's
rate-limited — see .env.example). The whole point of batching every
university into one gemini_client.search_universities() call is that this
script costs exactly ONE Gemini request no matter how large --batch-size is;
raise it and a full 166-university cycle finishes in fewer runs, at the cost
of a bigger prompt and more concurrent web searches per run.

Run this on a schedule (cron, a Render/Railway cron job, Windows Task
Scheduler) to keep the dataset from going stale — a full cycle at the
default batch size takes about 9 runs to touch every university once.
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db  # noqa: E402
import gemini_client  # noqa: E402

log = logging.getLogger("refresh_estimates")

_JSON_COLUMNS = ("intakes", "courses", "levels")


def _decode(rows):
    batch = []
    for row in rows:
        uni = dict(row)
        for column in _JSON_COLUMNS:
            uni[column] = json.loads(uni[column]) if uni.get(column) else []
        batch.append(uni)
    return batch


def _next_batch(conn, limit):
    """The `limit` universities least recently refreshed by this script (or
    never refreshed at all, which sort first)."""
    rows = conn.execute(
        "SELECT * FROM universities ORDER BY COALESCE(estimated_last_synced, '') ASC LIMIT ?",
        (limit,),
    ).fetchall()
    return _decode(rows)


def _named_batch(conn, names):
    rows = conn.execute(
        f"SELECT * FROM universities WHERE name IN ({','.join('?' for _ in names)})",
        names,
    ).fetchall()
    return _decode(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--batch-size", type=int, default=20, help="Universities to refresh this run")
    parser.add_argument("--dry-run", action="store_true", help="Log what would change without writing")
    parser.add_argument(
        "--name", action="append", dest="names",
        help="Refresh this exact university name instead of the oldest-synced batch. Repeatable.",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="  %(levelname)-7s %(message)s")

    try:
        conn = db.connect()
        try:
            batch = _named_batch(conn, args.names) if args.names else _next_batch(conn, args.batch_size)
            if not batch:
                log.info("No matching universities to refresh.")
                return 0

            log.info("Refreshing %d universities (oldest-synced first)...", len(batch))
            enriched = gemini_client.search_universities(None, None, None, None, None, batch)

            by_name = {u["name"].strip().lower(): u for u in batch}
            enriched_names = set()
            now = datetime.now(timezone.utc).isoformat()
            updated = 0

            for item in enriched:
                target = by_name.get((item.get("name") or "").strip().lower())
                if not target:
                    log.warning("Gemini returned an unmatched university: %r", item.get("name"))
                    continue
                enriched_names.add(target["name"].strip().lower())

                fields = {
                    "min_gpa": item.get("min_gpa"),
                    "min_ielts": item.get("min_ielts"),
                    "annual_tuition_gbp": item.get("annual_tuition_gbp"),
                    "scholarship": item.get("scholarship"),
                    "intakes": item.get("intakes") or [],
                    "courses": item.get("courses") or [],
                    "official_url": item.get("official_url") or None,
                    "data_status": item.get("data_status") or "Live data via Gemini + web search — verify before applying",
                }
                if args.dry_run:
                    log.info("[dry-run] %s -> %s", target["name"], fields)
                else:
                    db.update_university(target["id"], fields, conn)
                updated += 1

            # Universities Gemini skipped still get their timestamp bumped,
            # so a systematically-dropped university doesn't get retried
            # every single run forever ahead of everything else.
            if not args.dry_run:
                for uni in batch:
                    conn.execute(
                        "UPDATE universities SET estimated_last_synced = ? WHERE id = ?",
                        (now, uni["id"]),
                    )
                conn.commit()

            log.info("Updated %d/%d universities.", updated, len(batch))
            return 0
        finally:
            conn.close()
    finally:
        db.shutdown()


if __name__ == "__main__":
    raise SystemExit(main())
