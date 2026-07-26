import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import gemini_client

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="UK University Comparison Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://unimatch-4utmehiw5-aurtho1.vercel.app",
        "https://unimatch-lake.vercel.app"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Fallback dataset — used only if the live Gemini lookup fails (rate limit,
# outage, missing API key, unparsable response). GPA is on the Bangladeshi
# HSC scale (out of 5.0). "courses" = subject areas each university offers.
# ---------------------------------------------------------------------------
DATA_FILE = Path(__file__).parent / "universities_data.json"

with open(DATA_FILE, "r", encoding="utf-8") as f:
    UNIVERSITIES = json.load(f)

WALES_CITIES = ["cardiff", "newport", "pontypridd", "swansea", "bangor", "wrexham"]


def _filter_fallback_dataset(gpa, ielts, budget, course, city):
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

            if search_city == "wales":
                if uni_city not in WALES_CITIES and "wales" not in uni_city:
                    continue
            else:
                if search_city not in uni_city:
                    continue

        results.append(uni)

    return results


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
    candidates = _filter_fallback_dataset(gpa, ielts, budget, course, city)
    try:
        results = gemini_client.search_universities(gpa, ielts, budget, course, city, candidates)
        return {"count": len(results), "results": results, "source": "gemini"}
    except Exception:
        logger.exception("search_universities failed, falling back to static dataset")
        return {"count": len(candidates), "results": candidates, "source": "fallback"}


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
    all_cities = {uni["city"] for uni in UNIVERSITIES}
    all_cities.add("Wales")
    return {"cities": sorted(all_cities)}
