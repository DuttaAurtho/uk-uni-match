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
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory "database" — a static Python list, no real DB needed for now.
# GPA is on the Bangladeshi HSC scale (out of 5.0).
# "courses" = subject areas each university is strong in / offers.
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
        "courses": ["Computer Science", "Business", "Engineering", "Nursing"],
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
        "courses": ["Business", "Computer Science", "Architecture", "Law"],
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
        "courses": ["Engineering", "Business", "Computer Science", "Media"],
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
        "courses": ["Business", "Psychology", "Media", "Education"],
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
        "courses": ["Business", "Sports Science", "Computer Science", "Design"],
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
        "courses": ["Engineering", "Computer Science", "Business", "Pharmacy"],
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
        "courses": ["Business", "Engineering", "Computer Science", "Nursing"],
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
        "courses": ["Business", "Computer Science", "Law", "Psychology"],
    },
    {
        "id": 9,
        "name": "Anglia Ruskin University",
        "city": "Cambridge / Chelmsford, England",
        "min_gpa": 2.5,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 14500,
        "scholarship": "International Undergraduate Scholarship, no application needed",
        "intakes": ["September", "January"],
        "courses": ["Business", "Nursing", "Computer Science", "Law"],
    },
    {
        "id": 10,
        "name": "University of Sunderland",
        "city": "Sunderland, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 15000,
        "scholarship": "International Scholarship, up to £6,000 reduction",
        "intakes": ["September", "January"],
        "courses": ["Business", "Pharmacy", "Computer Science", "Engineering"],
    },
    {
        "id": 11,
        "name": "University of West London",
        "city": "London, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 15500,
        "scholarship": "Early Settlement Discount, £500",
        "intakes": ["September", "January"],
        "courses": ["Business", "Nursing", "Music", "Computer Science"],
    },
    {
        "id": 12,
        "name": "Teesside University",
        "city": "Middlesbrough, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 16000,
        "scholarship": "TEF Gold rated, merit scholarships available",
        "intakes": ["September", "January"],
        "courses": ["Computer Science", "Business", "Engineering", "Animation"],
    },
    {
        "id": 13,
        "name": "Leeds Beckett University",
        "city": "Leeds, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 15500,
        "scholarship": "International merit scholarships available",
        "intakes": ["September", "January"],
        "courses": ["Business", "Sports Science", "Computer Science", "Law"],
    },
    {
        "id": 14,
        "name": "Northumbria University",
        "city": "Newcastle upon Tyne, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 16500,
        "scholarship": "International merit scholarship available",
        "intakes": ["September", "January"],
        "courses": ["Business", "Law", "Computer Science", "Design"],
    },
    {
        "id": 15,
        "name": "University of Portsmouth",
        "city": "Portsmouth, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 16700,
        "scholarship": "Global Excellence Scholarship available",
        "intakes": ["September", "January"],
        "courses": ["Business", "Computer Science", "Pharmacy", "Engineering"],
    },
    {
        "id": 16,
        "name": "University of Greenwich",
        "city": "London, England",
        "min_gpa": 3.0,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 16800,
        "scholarship": "International Scholarship Award, up to £3,500 off",
        "intakes": ["September", "January"],
        "courses": ["Business", "Architecture", "Computer Science", "Pharmacy"],
    },
    {
        "id": 17,
        "name": "University of Bedfordshire",
        "city": "Luton, England",
        "min_gpa": 2.5,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 14000,
        "scholarship": "International Excellence Scholarship available",
        "intakes": ["September", "January"],
        "courses": ["Business", "Computer Science", "Nursing", "Law"],
    },
    {
        "id": 18,
        "name": "University of Wolverhampton",
        "city": "Wolverhampton, England",
        "min_gpa": 2.5,
        "min_ielts": 6.0,
        "annual_tuition_gbp": 14000,
        "scholarship": "Vice-Chancellor's Scholarship available",
        "intakes": ["September", "January"],
        "courses": ["Business", "Computer Science", "Engineering", "Education"],
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
        if gpa is not None and gpa < uni["min_gpa"]:
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