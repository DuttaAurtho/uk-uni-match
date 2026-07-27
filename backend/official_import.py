"""Pull tuition and English-language figures out of a university's own page.

The point of this module is provenance: every figure it returns carries the
sentence it came from and the URL that sentence was on, so nothing enters the
database that cannot be shown to a student (see db.field_sources).

Why it takes page text as well as a URL
---------------------------------------
Fetching a UK university fee page server-side works less often than you would
hope. Measured against real sites:

  * manchester.ac.uk       — fetches fine, but the page carries no figures at
                             all; the numbers are rendered by JavaScript or
                             live on individual course pages
  * mmu.ac.uk              — HTTP 403 to any scripted request, browser
                             user-agent or not
  * others                 — fine

So `fetch_page_text` is only ever the first attempt. When it comes back empty
or thin, the caller is expected to ask a human to paste the page text
instead: their browser has already rendered the JavaScript and is not being
blocked, which makes it the one source that always works. Either way the URL
is what gets recorded as the citation.

Extraction is deliberately regex-based rather than LLM-based. It costs no API
quota, so it can run across the whole dataset, and its output is a literal
span of the page rather than a model's paraphrase of one — which is exactly
what the provenance system needs to verify.
"""

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import gemini_client

# Enough text to cover a fees table; beyond this we're into related-links
# boilerplate.
MAX_CHARS = 40000
# Below this a "successful" fetch is really a cookie wall or a hub page with
# no content, and a human paste will do better.
THIN_PAGE_CHARS = 2500

_MONEY = re.compile(r"£\s?(\d{1,3}(?:,\d{3})+|\d{4,6})(?:\.\d{2})?")
_IELTS = re.compile(r"IELTS[^.\n]{0,80}?(\d(?:\.\d)?)", re.IGNORECASE)

# A figure only counts as international tuition if the sentence around it says
# so. Home/EU fees sit on the same pages and are usually the smaller number,
# so taking figures indiscriminately would systematically understate costs.
_INTERNATIONAL_HINTS = (
    "international", "overseas", "non-uk", "non uk", "eu and international",
    "international students", "island and international",
)
_EXCLUDE_HINTS = (
    "home student", "home fee", "uk student", "scholarship of", "bursary of",
    "deposit", "per credit", "living cost", "accommodation",
)
# Anything outside this band is not an annual tuition fee — it's a deposit, a
# scholarship award, a per-module charge or a total-across-3-years figure.
MIN_PLAUSIBLE_FEE = 8000
MAX_PLAUSIBLE_FEE = 60000


def fetch_page_text(url: str) -> str:
    """The page as plain text, or "" if it can't be read. Never raises."""
    return gemini_client._fetch_page_text(url, max_chars=MAX_CHARS) or ""


def _sentences(text: str) -> List[str]:
    # Fee pages are full of "£16,500." and "e.g." so a naive split on "." is
    # noisy; splitting on sentence-end punctuation followed by a capital or a
    # £ keeps figures attached to their own clause.
    parts = re.split(r"(?<=[.!?;])\s+(?=[A-Z£])|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _classify(sentence: str) -> Optional[str]:
    low = sentence.lower()
    if any(h in low for h in _EXCLUDE_HINTS):
        return None
    if any(h in low for h in _INTERNATIONAL_HINTS):
        return "international"
    return "unlabelled"


def extract_fees(text: str) -> Dict[str, Any]:
    """Candidate annual international tuition figures, each with the sentence
    that stated it. Sentences explicitly about international fees win; when
    none say so, unlabelled figures are returned but flagged, so a human can
    decide rather than the parser guessing."""
    labelled: List[Dict[str, Any]] = []
    unlabelled: List[Dict[str, Any]] = []

    for sentence in _sentences(text):
        kind = _classify(sentence)
        if kind is None:
            continue
        for match in _MONEY.finditer(sentence):
            amount = int(match.group(1).replace(",", ""))
            if not MIN_PLAUSIBLE_FEE <= amount <= MAX_PLAUSIBLE_FEE:
                continue
            row = {"amount": amount, "quote": sentence[:400]}
            (labelled if kind == "international" else unlabelled).append(row)

    chosen = labelled or unlabelled
    if not chosen:
        return {"found": False, "confident": False, "candidates": []}

    amounts = sorted({c["amount"] for c in chosen})
    return {
        "found": True,
        # Only figures whose own sentence names international students are
        # trustworthy without review.
        "confident": bool(labelled),
        "min": amounts[0],
        "max": amounts[-1],
        "representative": amounts[len(amounts) // 2],
        "quote": min(chosen, key=lambda c: c["amount"])["quote"],
        "candidates": chosen[:12],
    }


def extract_ielts(text: str) -> Dict[str, Any]:
    """The overall IELTS band, with its sentence. Takes the lowest plausible
    band mentioned: pages list the minimum first and then higher bands for
    specific courses, and the minimum is what decides eligibility."""
    hits = []
    for sentence in _sentences(text):
        for match in _IELTS.finditer(sentence):
            band = float(match.group(1))
            if 4.0 <= band <= 9.0:
                hits.append({"band": band, "quote": sentence[:400]})
    if not hits:
        return {"found": False}
    best = min(hits, key=lambda h: h["band"])
    return {"found": True, "band": best["band"], "quote": best["quote"], "candidates": hits[:8]}


def analyse(url: str, page_text: Optional[str] = None) -> Dict[str, Any]:
    """Read a university page and propose figures from it.

    Returns the proposal rather than writing anything: what gets saved is an
    admin's decision, because an unlabelled figure on a fees page is as likely
    to be a home fee as an international one.
    """
    text = (page_text or "").strip()
    source = "pasted"
    if not text:
        text = fetch_page_text(url)
        source = "fetched"

    text = text[:MAX_CHARS]
    if not text:
        return {
            "ok": False,
            "source": "unavailable",
            "reason": (
                "That page couldn't be read from the server — it either blocks "
                "automated requests or builds its content with JavaScript. Open "
                "it in your browser, select all, and paste the text instead."
            ),
        }
    if source == "fetched" and len(text) < THIN_PAGE_CHARS:
        return {
            "ok": False,
            "source": "thin",
            "chars": len(text),
            "reason": (
                f"Only {len(text)} characters came back, which usually means a "
                "cookie wall or a landing page rather than the fees themselves. "
                "Paste the page text to be sure."
            ),
        }

    fees = extract_fees(text)
    ielts = extract_ielts(text)
    checked_at = datetime.now(timezone.utc).date().isoformat()

    proposal: Dict[str, Any] = {}
    sources: Dict[str, Any] = {}
    if fees.get("found"):
        proposal["annual_tuition_gbp"] = fees["representative"]
        proposal["tuition_min_gbp"] = fees["min"]
        proposal["tuition_max_gbp"] = fees["max"]
        entry = {"quote": fees["quote"], "url": url, "checked_at": checked_at}
        for field in ("annual_tuition_gbp", "tuition_min_gbp", "tuition_max_gbp"):
            sources[field] = entry
    if ielts.get("found"):
        proposal["min_ielts"] = ielts["band"]
        sources["min_ielts"] = {"quote": ielts["quote"], "url": url, "checked_at": checked_at}

    return {
        "ok": bool(proposal),
        "source": source,
        "chars": len(text),
        "confident": fees.get("confident", False),
        "fees": fees,
        "ielts": ielts,
        "proposal": proposal,
        "field_sources": sources,
        "reason": None if proposal else (
            "The page was read, but no annual international fee between "
            f"£{MIN_PLAUSIBLE_FEE:,} and £{MAX_PLAUSIBLE_FEE:,} and no IELTS band "
            "appeared in it. Fees often live on individual course pages rather "
            "than a central one — try a course page URL."
        ),
    }
