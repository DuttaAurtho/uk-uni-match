from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

app = FastAPI(title="UK University Comparison Tool API")

# Allow the Next.js frontend (running on localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory "database" — a static Python list, no real DB needed for now.
# GPA is on the Bangladeshi HSC scale (out of 5.0).
# ---------------------------------------------------------------------------
UNIVERSITIES = [
    {
        "id": 1,
        "name": "University of South Wales",
        "city": "Treforest, Wales",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 14750,
        "scholarship": "Up to 20% international merit scholarship",
        "intakes": ["September", "January"],
    },
    {
        "id": 2,
        "name": "UWE Bristol",
        "city": "Bristol, England",
        "min_gpa": 3.5,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 16750,
        "scholarship": "Global Talent Scholarship, up to £2,000",
        "intakes": ["September"],
    },
    {
        "id": 3,
        "name": "Coventry University",
        "city": "Coventry, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 17700,
        "scholarship": "International scholarship up to £2,000",
        "intakes": ["September", "January"],
    },
    {
        "id": 4,
        "name": "University of Roehampton",
        "city": "London, England",
        "min_gpa": 2.5,
        "min_ielts": 5.5,
        "annual_tuition_gbp": 15500,
        "scholarship": "Vice-Chancellor's scholarship, up to 30%",
        "intakes": ["September", "January"],
    },
    {
        "id": 5,
        "name": "Cardiff Metropolitan University",
        "city": "Cardiff, Wales",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 13750,
        "scholarship": "Early bird discount available",
        "intakes": ["September", "January"],
    },
    {
        "id": 6,
        "name": "University of Hertfordshire",
        "city": "Hatfield, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 15750,
        "scholarship": "International merit scholarship, up to £2,000",
        "intakes": ["September", "January"],
    },
    {
        "id": 7,
        "name": "Sheffield Hallam University",
        "city": "Sheffield, England",
        "min_gpa": 3.5,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 16000,
        "scholarship": "Vice-Chancellor's Scholarship, up to £2,000",
        "intakes": ["September", "January"],
    },
    {
        "id": 8,
        "name": "University of East London",
        "city": "London, England",
        "min_gpa": 2.5,
        "min_ielts": 5.5,
        "annual_tuition_gbp": 14400,
        "scholarship": "Global Excellence Scholarship, up to £3,000",
        "intakes": ["September", "January", "May"],
    },
]


@app.get("/")
def root():
    return {"status": "ok", "message": "UK University Comparison Tool API is running"}


@app.get("/universities")
def get_universities(
    gpa: Optional[float] = Query(None, description="Student's GPA out of 5.0"),
    ielts: Optional[float] = Query(None, description="Student's IELTS overall band"),
    budget: Optional[float] = Query(None, description="Max annual tuition budget in GBP"),
):
    """
    Returns universities the student is eligible for, filtered by GPA, IELTS
    and budget. Any filter left out is simply ignored (no restriction on it).
    """
    results = []
    for uni in UNIVERSITIES:
        if gpa is not None and gpa < uni["min_gpa"]:
            continue
        if ielts is not None and ielts < uni["min_ielts"]:
            continue
        if budget is not None and uni["annual_tuition_gbp"] > budget:
            continue
        results.append(uni)

    return {"count": len(results), "results": results}
