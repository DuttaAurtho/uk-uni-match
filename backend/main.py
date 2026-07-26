import logging
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
import gemini_client

load_dotenv()

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="UK University Comparison Tool API")

# Local dev plus the known production frontends. Vercel mints a fresh URL for
# every preview deploy, so the regex keeps those working without a code change
# each time; extra origins can be added via CORS_ORIGINS (comma-separated).
DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://unimatch-4utmehiw5-aurtho1.vercel.app",
    "https://unimatch-lake.vercel.app",
]
_extra = os.environ.get("CORS_ORIGINS", "")
ALLOWED_ORIGINS = DEFAULT_ORIGINS + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# The full set of UK universities. Every search filters this list; the
# best-matching few are then enriched with live data (see ENRICH_LIMIT), and
# the rest are returned as-is with their "Estimated" data_status so the user
# still sees every university they qualify for. GPA is on the Bangladeshi HSC
# scale (out of 5.0). "courses" = subject areas each university offers.
# ---------------------------------------------------------------------------
# Loaded from SQLite. db.init() migrates and, on a fresh database, seeds from
# universities_data.json — which is now the seed for our *estimated* figures
# only. Official statistics land separately via scripts/sync_discover_uni.py.
UNIVERSITIES = db.init()

# How many of the top-ranked matches get a live Gemini + web-search lookup.
# Each one costs a search and shares a single Gemini call, so this is capped
# to stay inside the API key's small daily quota.
ENRICH_LIMIT = 10

# Nation-level filters, so a student can type "Scotland" instead of naming a
# city. Any city not listed here is in England.
REGION_CITIES = {
    "wales": {
        "aberystwyth", "bangor", "cardiff", "carmarthen", "newport",
        "pontypridd", "swansea", "wrexham",
    },
    "scotland": {
        "aberdeen", "dundee", "edinburgh", "glasgow", "inverness",
        "paisley", "st andrews", "stirling",
    },
    "northern ireland": {"belfast", "derry", "londonderry"},
}
REGION_ALIASES = {
    "cymru": "wales",
    "alba": "scotland",
    "scottish": "scotland",
    "welsh": "wales",
    "ni": "northern ireland",
    "n. ireland": "northern ireland",
}


def _region_match(search_city: str, uni_city: str) -> Optional[bool]:
    """True/False if `search_city` is a nation name, else None (not a region)."""
    region = REGION_ALIASES.get(search_city, search_city)
    if region == "england":
        non_english = set().union(*REGION_CITIES.values())
        return uni_city not in non_english
    cities = REGION_CITIES.get(region)
    if cities is None:
        return None
    return uni_city in cities or region in uni_city


def _filter_universities(gpa, ielts, budget, course, city):
    results = []
    for uni in UNIVERSITIES:
        if gpa is not None and uni["min_gpa"] is not None and gpa < uni["min_gpa"]:
            continue
        if ielts is not None and ielts < uni["min_ielts"]:
            continue
        if budget is not None and uni["annual_tuition_gbp"] > budget:
            continue
        if course is not None:
            course_match = any(
                course.strip().lower() in c.lower() for c in uni.get("courses", [])
            )
            if not course_match:
                continue

        if city is not None:
            search_city = city.strip().lower()
            uni_city = uni["city"].lower()

            region_hit = _region_match(search_city, uni_city)
            if region_hit is not None:
                if not region_hit:
                    continue
            elif search_city not in uni_city:
                continue

        results.append(uni)

    return results


def _rank(candidates, gpa, ielts):
    """Best fit first, so the live-lookup budget is spent on the universities
    the student is most likely to actually care about. Ties break on cheaper
    tuition, then name, to keep ordering stable across identical requests."""

    def score(uni):
        margin = 0.0
        if gpa is not None and uni["min_gpa"] is not None:
            margin += gpa - uni["min_gpa"]
        if ielts is not None:
            margin += ielts - uni["min_ielts"]
        return (-margin, uni["annual_tuition_gbp"], uni["name"])

    return sorted(candidates, key=score)


def _as_result(uni: dict) -> dict:
    """Shape a static entry like an enriched one, so the frontend can render
    both from a single card component. `data_status` is what tells the two
    apart in the UI."""
    return {
        "id": uni["id"],
        "name": uni["name"],
        "city": uni["city"],
        "annual_tuition_gbp": uni["annual_tuition_gbp"],
        "min_gpa": uni["min_gpa"],
        "min_ielts": uni["min_ielts"],
        "scholarship": uni.get("scholarship", ""),
        "intakes": uni.get("intakes", []),
        "courses": uni.get("courses", []),
        "why_it_matches": "",
        "official_url": "",
        "data_status": uni.get("data_status", "Estimated - please verify"),
        # Official Discover Uni statistics, kept in their own namespace so the
        # UI can badge them as verified government data — unlike the tuition
        # and IELTS figures above, which remain our estimates.
        "official": _official_block(uni),
    }


def _attach_official(results: List[dict], source_rows: List[dict]) -> None:
    """Copy the official statistics onto results built elsewhere, matching on
    name. Every result carries an `official` key (possibly None) so the
    frontend never has to distinguish 'no data' from 'field absent'."""
    by_name = {u["name"].strip().lower(): u for u in source_rows}
    for result in results:
        row = by_name.get((result.get("name") or "").strip().lower())
        result["official"] = _official_block(row) if row else None


def _official_block(uni: dict) -> Optional[dict]:
    """The Discover Uni figures for a university, or None if never synced."""
    if not uni.get("official_last_synced"):
        return None
    return {
        "nss_satisfaction": uni.get("official_nss_satisfaction"),
        "employment_pct": uni.get("official_employment_pct"),
        "median_salary_gbp": uni.get("official_median_salary_gbp"),
        "continuation_pct": uni.get("official_continuation_pct"),
        "course_count": uni.get("official_course_count"),
        "source": uni.get("official_source"),
        "last_synced": uni.get("official_last_synced"),
    }


def _find_in_fallback_dataset(name: str) -> Optional[dict]:
    needle = name.strip().lower()
    for uni in UNIVERSITIES:
        if uni["name"].strip().lower() == needle:
            return uni
    for uni in UNIVERSITIES:
        if needle in uni["name"].strip().lower() or uni["name"].strip().lower() in needle:
            return uni
    return None


def _fallback_details(uni: dict) -> dict:
    requirement_bits = []
    if uni.get("min_gpa") is not None:
        requirement_bits.append(f"GPA {uni['min_gpa']}+ (out of 5.0)")
    requirement_bits.append(f"IELTS {uni['min_ielts']}+ overall")
    return {
        "name": uni["name"],
        "overview": f"{uni['name']} is located in {uni['city']}.",
        "entry_requirements": "Typically requires " + " and ".join(requirement_bits) + ".",
        "tuition_breakdown": f"Estimated annual tuition: £{uni['annual_tuition_gbp']:,}.",
        "scholarships": uni.get("scholarship", ""),
        "application_deadlines": "Check the university's official admissions page for current deadlines.",
        "notable_strengths": "Offers courses in: " + ", ".join(uni.get("courses", [])) + ".",
        "visa_notes": "International students typically need a UK Student visa (CAS) — check gov.uk for current requirements.",
        "official_url": "",
    }


@app.get("/")
def root():
    return {"status": "ok", "message": "UK University Comparison Tool API is running"}


@app.get("/universities")
def get_universities(
    gpa: Optional[float] = Query(None, description="Student's GPA out of 5.0"),
    ielts: Optional[float] = Query(None, description="Student's IELTS overall band"),
    budget: Optional[float] = Query(None, description="Max annual tuition budget in GBP"),
    course: Optional[str] = Query(None, description="Subject/course keyword, e.g. 'Computer Science'"),
    city: Optional[str] = Query(None, description="Preferred city or region, e.g. 'London'"),
):
    candidates = _rank(_filter_universities(gpa, ielts, budget, course, city), gpa, ielts)
    if not candidates:
        return {"count": 0, "results": [], "source": "none", "enriched_count": 0}

    top, rest = candidates[:ENRICH_LIMIT], candidates[ENRICH_LIMIT:]

    try:
        enriched = gemini_client.search_universities(gpa, ielts, budget, course, city, top)
        # The enrichment path builds its own dicts from the model response, so
        # it doesn't carry the official statistics. Re-attach them from the
        # matching DB row — otherwise the top results (the ones a student
        # actually reads) would be the only ones missing the field.
        _attach_official(enriched, top)
    except Exception:
        logger.exception("search_universities failed, serving estimated data only")
        results = [_as_result(u) for u in candidates]
        return {
            "count": len(results),
            "results": results,
            "source": "fallback",
            "enriched_count": 0,
        }

    # Anything Gemini dropped from `top` still deserves to be shown, just
    # without the live figures.
    enriched_names = {r["name"].strip().lower() for r in enriched}
    remainder = [u for u in top if u["name"].strip().lower() not in enriched_names] + rest

    results = enriched + [_as_result(u) for u in remainder]
    return {
        "count": len(results),
        "results": results,
        "source": "gemini",
        "enriched_count": len(enriched),
    }


class UniversityDetailsRequest(BaseModel):
    name: str
    city: Optional[str] = None
    course: Optional[str] = None


@app.post("/universities/details")
def university_details(payload: UniversityDetailsRequest):
    try:
        data = gemini_client.get_university_details(payload.name, payload.city, payload.course)
        return {"source": "gemini", **data}
    except Exception:
        logger.exception("get_university_details failed for %s", payload.name)
        fallback_uni = _find_in_fallback_dataset(payload.name)
        if fallback_uni:
            return {"source": "fallback", **_fallback_details(fallback_uni)}
        return {
            "source": "unavailable",
            "name": payload.name,
            "message": "Couldn't fetch live details right now — please check the university's official website directly.",
        }


class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, Any]] = []
    context: Optional[Dict[str, Any]] = None


@app.post("/chat")
def chat(payload: ChatRequest):
    try:
        reply = gemini_client.chat_reply(payload.message, payload.history, payload.context)
        return {"reply": reply, "ok": True}
    except Exception:
        logger.exception("chat_reply failed")
        return {
            "reply": "Sorry, the AI assistant is unavailable right now. Please try again in a moment.",
            "ok": False,
        }


@app.get("/courses")
def get_all_courses():
    all_courses = set()
    for uni in UNIVERSITIES:
        all_courses.update(uni.get("courses", []))
    return {"courses": sorted(all_courses)}


@app.get("/cities")
def get_all_cities():
    all_cities = sorted({uni["city"] for uni in UNIVERSITIES})
    # Nations first — they're the broadest, most useful filters.
    regions = ["England", "Scotland", "Wales", "Northern Ireland"]
    return {"cities": regions + all_cities}


@app.get("/stats")
def get_stats():
    return {
        "university_count": len(UNIVERSITIES),
        "city_count": len({uni["city"] for uni in UNIVERSITIES}),
        "course_count": len({c for uni in UNIVERSITIES for c in uni.get("courses", [])}),
    }
