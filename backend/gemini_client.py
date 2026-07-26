"""Gemini-backed lookups for university search, detail, and chat.

Real-time facts come from a free DuckDuckGo web search (no API key, no
billing) whose snippets are fed into Gemini's plain `generate_content` call
as context — this stands in for Gemini's own Google Search grounding tool,
which requires a billing-enabled project and isn't available here. Callers
(main.py) are expected to catch exceptions from these functions and fall
back to the static dataset.
"""

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

from ddgs import DDGS
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
CACHE_TTL_SECONDS = 6 * 60 * 60

_client = None
_cache = {}


def _get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=api_key)
    return _client


def _cache_get(key):
    entry = _cache.get(key)
    if entry is None:
        return None
    stored_at, value = entry
    if time.time() - stored_at > CACHE_TTL_SECONDS:
        del _cache[key]
        return None
    return value


def _cache_set(key, value):
    _cache[key] = (time.time(), value)


def _web_search(query, max_results=5):
    """Free, keyless web search. Never raises — returns [] on any failure
    so a flaky search never blocks a call that could still partially work
    from the model's own knowledge."""
    try:
        return DDGS().text(query, max_results=max_results) or []
    except Exception:
        return []


def _format_search_context(results):
    if not results:
        return "(no search results found — use your best general knowledge, and say so if unsure)"
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r.get('title', '')} — {r.get('href', '')}\n   {r.get('body', '')}")
    return "\n".join(lines)


def _ac_uk_url(results):
    """A real UK university domain spotted in search results — trusted
    over anything the model claims on its own, since it's observed
    evidence rather than a model guess."""
    for r in results:
        href = r.get("href", "")
        if ".ac.uk" in href:
            return href
    return None


def _best_guess_url(results):
    return results[0]["href"] if results else ""


_URL_RE = re.compile(r"^https?://\S+$")


def _clean_url(value):
    """Gemini sometimes appends commentary to a URL field (e.g. '...uk/
    (estimated, not in search results)'). Only accept the value if it's a
    single bare URL with no trailing prose."""
    if not value or not isinstance(value, str):
        return None
    value = value.strip()
    return value if _URL_RE.match(value) else None


def _extract_json(text):
    """Pull a JSON array/object out of a model response, tolerating
    ```json fences or stray prose around the payload."""
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start_chars = "[{"
    for i, ch in enumerate(text):
        if ch in start_chars:
            closing = "]" if ch == "[" else "}"
            end = text.rfind(closing)
            if end > i:
                candidate = text[i : end + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue
    raise ValueError("Could not find valid JSON in Gemini response")


def _generate(prompt, system_instruction, temperature=0.3):
    client = _get_client()
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )
    if not response.text:
        raise ValueError("Empty response from Gemini")
    return response.text


SEARCH_SYNTHESIS_SYSTEM_INSTRUCTION = (
    "You are a UK higher-education admissions research assistant for "
    "prospective international students, particularly from Bangladesh. "
    "For each university you'll be given a rough existing estimate plus "
    "real web search snippets — prefer the search snippets whenever they "
    "cover a fact, since the estimate may be outdated; otherwise keep the "
    "estimate rather than guessing something new. Respond with ONLY a "
    "JSON array, no prose, no markdown fences."
)


def search_universities(gpa, ielts, budget, course, city, candidates):
    """`candidates` is a pre-filtered list of real universities (from our
    own static dataset, matched against the same criteria) to enrich with
    live search data. Sourcing names this way — instead of asking Gemini to
    invent a candidate list — saves a whole Gemini call per search, which
    matters a lot given this API key's very small daily request quota."""
    cache_key = ("search", gpa, ielts, budget, course, city)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    criteria = [
        f"HSC/GPA of {gpa} (out of 5.0)" if gpa is not None else None,
        f"IELTS overall band of {ielts}" if ielts is not None else None,
        f"a maximum annual tuition budget of £{budget}" if budget is not None else None,
        f"interested in studying {course}" if course else None,
        f"preferring the city/region of {city}" if city else None,
    ]
    criteria_text = "; ".join(c for c in criteria if c)

    # The caller (main.py) decides how many to enrich via its ENRICH_LIMIT —
    # it has already ranked and sliced the list, so take it as given.
    named_candidates = [c for c in candidates if c.get("name")]
    if not named_candidates:
        raise ValueError("No candidate universities to enrich")

    def _enrich(c):
        name, city_name = c["name"], c.get("city", "")
        query = f"{name} {city_name} international tuition fees IELTS entry requirements {course or ''}".strip()
        results = _web_search(query, max_results=4)
        return {
            "name": name,
            "city": city_name,
            "baseline": c,
            "ac_uk_url": _ac_uk_url(results),
            "best_guess_url": _best_guess_url(results),
            "search_context": _format_search_context(results),
        }

    with ThreadPoolExecutor(max_workers=min(10, len(named_candidates))) as pool:
        enriched = list(pool.map(_enrich, named_candidates))

    if not enriched:
        raise ValueError("No candidate universities found")

    candidates_block = "\n\n".join(
        f"University: {e['name']} ({e['city']})\n"
        f"Our existing estimate (may be outdated — verify/update using the "
        f"search results below): tuition £{e['baseline'].get('annual_tuition_gbp')}, "
        f"min GPA {e['baseline'].get('min_gpa')}, min IELTS {e['baseline'].get('min_ielts')}\n"
        f"Search results:\n{e['search_context']}"
        for e in enriched
    )

    synthesis_prompt = f"""Student profile: {criteria_text or "no specific constraints given"}.

Using the real web search results below for each university, return a JSON
array where each item has exactly these keys:
- "name": string
- "city": string
- "annual_tuition_gbp": number, estimated annual tuition in GBP for an
  international student in the relevant course
- "min_gpa": number or null, typical minimum HSC/GPA equivalent out of 5.0
  if determinable, else null
- "min_ielts": number, typical minimum IELTS overall band required
- "scholarship": string, one short sentence about scholarships for
  international students
- "intakes": array of strings, e.g. ["September", "January"]
- "courses": array of 1-5 strings, subject areas relevant to the query
- "why_it_matches": string, one short sentence on why this fits the profile
- "official_url": string, the university's official site as a bare URL
  only (e.g. "https://www.example.ac.uk") — no extra words or notes

{candidates_block}

Only return the JSON array, nothing else."""

    response_text = _generate(synthesis_prompt, SEARCH_SYNTHESIS_SYSTEM_INSTRUCTION)
    data = _extract_json(response_text)
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array from Gemini search response")

    enriched_by_name = {e["name"].lower(): e for e in enriched}

    results = []
    seen_names = set()
    for item in data:
        name = item.get("name")
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())
        enrich_info = enriched_by_name.get(name.lower(), {})
        official_url = (
            enrich_info.get("ac_uk_url")
            or _clean_url(item.get("official_url"))
            or enrich_info.get("best_guess_url", "")
        )
        results.append(
            {
                "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
                "name": name,
                "city": item.get("city", ""),
                "annual_tuition_gbp": item.get("annual_tuition_gbp"),
                "min_gpa": item.get("min_gpa"),
                "min_ielts": item.get("min_ielts"),
                "scholarship": item.get("scholarship", ""),
                "intakes": item.get("intakes", []) or [],
                "courses": item.get("courses", []) or [],
                "why_it_matches": item.get("why_it_matches", ""),
                "official_url": official_url,
                "data_status": "Live data via Gemini + web search — verify before applying",
            }
        )

    _cache_set(cache_key, results)
    return results


DETAILS_SYSTEM_INSTRUCTION = (
    "You are a UK higher-education admissions research assistant. You will "
    "be given real web search snippets about a specific university — use "
    "ONLY those for facts, and clearly say when something is an estimate "
    "rather than confirmed. Respond with ONLY a JSON object, no prose, no "
    "markdown fences."
)


def get_university_details(name, city, course):
    cache_key = ("details", name, city, course)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    query = f"{name} {city or ''} tuition fees entry requirements scholarships application deadlines visa official site".strip()
    results = _web_search(query, max_results=6)
    if not results:
        raise ValueError("No search results found for this university")

    course_line = f" for their {course} course" if course else ""
    prompt = f"""Using the real web search results below about "{name}" in
{city or 'the UK'}, write a detailed profile for a prospective
international student{course_line}.

Search results:
{_format_search_context(results)}

Return a JSON object with exactly these keys:
- "name": string
- "overview": string, 2-3 sentences about the university
- "entry_requirements": string, academic + English language requirements
- "tuition_breakdown": string, tuition and estimated living cost detail
- "scholarships": string, scholarships/financial aid for international
  students
- "application_deadlines": string, key deadlines and process notes
- "notable_strengths": string, what this university/course is known for
- "visa_notes": string, brief note on student visa (CAS) requirements
- "official_url": string, the official admissions/course page as a bare
  URL only (e.g. "https://www.example.ac.uk") — no extra words or notes

Only return the JSON object, nothing else."""

    response_text = _generate(prompt, DETAILS_SYSTEM_INSTRUCTION)
    data = _extract_json(response_text)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object from Gemini details response")

    data["official_url"] = (
        _ac_uk_url(results) or _clean_url(data.get("official_url")) or _best_guess_url(results)
    )

    _cache_set(cache_key, data)
    return data


CHAT_SYSTEM_INSTRUCTION = (
    "You are a friendly, knowledgeable assistant helping a prospective "
    "international student (often from Bangladesh) plan UK university "
    "applications. You'll sometimes be given real web search snippets — "
    "use them for anything fact-dependent (fees, deadlines, visa rules). "
    "Keep answers concise and practical. If you're not sure of something "
    "and the snippets don't cover it, say so instead of guessing."
)


def chat_reply(message, history, context):
    contents = []
    for turn in history or []:
        role = "model" if turn.get("role") == "assistant" else "user"
        text = turn.get("text", "")
        if text:
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))

    context_lines = []
    profile = (context or {}).get("profile")
    if profile:
        context_lines.append(
            "Student profile — GPA: {gpa}, IELTS: {ielts}, budget: £{budget}/yr, "
            "course interest: {course}, preferred city: {city}.".format(
                gpa=profile.get("gpa") or "not given",
                ielts=profile.get("ielts") or "not given",
                budget=profile.get("budget") or "not given",
                course=profile.get("course") or "not given",
                city=profile.get("city") or "not given",
            )
        )
    university = (context or {}).get("university")
    search_query = message
    if university:
        context_lines.append(
            f"The student is currently looking at {university.get('name')} "
            f"in {university.get('city')}."
        )
        search_query = f"{university.get('name')} {message}"

    search_results = _web_search(search_query, max_results=4)
    context_lines.append(f"Web search results:\n{_format_search_context(search_results)}")

    user_message = message
    if context_lines:
        user_message = "\n".join(context_lines) + "\n\nQuestion: " + message

    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))

    client = _get_client()
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=CHAT_SYSTEM_INSTRUCTION,
            temperature=0.5,
        ),
    )
    if not response.text:
        raise ValueError("Empty response from Gemini")
    return response.text.strip()
