from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

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
# In-memory "database" — a static Python list, no real DB needed for now.
# GPA is on the Bangladeshi HSC scale (out of 5.0).
# "courses" = subject areas each university is strong in / offers.
# ---------------------------------------------------------------------------

import json
from pathlib import Path

# ---------------------------------------------------------------------------
# In-memory "database" — loaded from a JSON file so it can be updated
# without touching code. GPA is on the Bangladeshi HSC scale (out of 5.0).
# "courses" = subject areas each university is strong in / offers.
# ---------------------------------------------------------------------------
DATA_FILE = Path(__file__).parent / "universities_data.json"

with open(DATA_FILE, "r", encoding="utf-8") as f:
    UNIVERSITIES = json.load(f)


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
    """
    Returns universities the student is eligible for, filtered by GPA, IELTS,
    budget, course/subject, and city preference. Any filter left out is
    simply ignored (no restriction on it).
    """
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
        if city is not None and city.strip().lower() not in uni["city"].lower():
            continue
        results.append(uni)

    return {"count": len(results), "results": results}


@app.get("/courses")
def get_all_courses():
    """Returns a deduplicated, sorted list of all course/subject names — useful
    for populating a dropdown filter on the frontend."""
    all_courses = set()
    for uni in UNIVERSITIES:
        all_courses.update(uni.get("courses", []))
    return {"courses": sorted(all_courses)}


@app.get("/cities")
def get_all_cities():
    """Returns a deduplicated, sorted list of all cities — useful for a
    city-preference dropdown on the frontend."""
    all_cities = sorted({uni["city"] for uni in UNIVERSITIES})
    return {"cities": all_cities}