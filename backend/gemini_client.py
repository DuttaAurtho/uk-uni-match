"""LLM-backed lookups for university search, detail, and chat.

Despite the module name this is provider-agnostic: the actual model call goes
through `llm_provider`, which runs on Gemini or Claude depending on
LLM_PROVIDER. Everything here — prompt building, search, caching, parsing — is
shared between them.

Real-time facts come from a free DuckDuckGo web search (no API key, no
billing) whose snippets are fed to the model as context — this stands in for
Gemini's own Google Search grounding tool, which requires a billing-enabled
project and isn't available here. Callers (main.py) are expected to catch
exceptions from these functions and fall back to the static dataset.
"""

import html
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from ddgs import DDGS
from dotenv import load_dotenv

import llm_provider

load_dotenv()

CACHE_TTL_SECONDS = 6 * 60 * 60

_cache = {}


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


_PAGE_FETCH_TIMEOUT_SECONDS = 10
_PAGE_FETCH_MAX_CHARS = 10000


def _fetch_page_text(url, max_chars=None):
    """Best-effort plain text of a page we already know is this university's
    official site — search snippets are short excerpts of whatever page
    happened to rank, which is often a generic fees overview rather than the
    specific course page, so a known-good URL is worth reading directly.
    Never raises: many sites block simple requests or need JS to render, and
    an empty string here just means the caller falls back to search alone."""
    if not url:
        return ""
    try:
        request = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (compatible; UKUniMatchBot/1.0)"}
        )
        with urllib.request.urlopen(request, timeout=_PAGE_FETCH_TIMEOUT_SECONDS) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            raw = response.read(500_000).decode(charset, errors="ignore")
    except Exception:
        return ""

    # Site chrome (nav/header/footer) is often thousands of characters of
    # menu links before the actual page content starts — strip it first so
    # the character budget below is spent on content, not "Skip to main
    # content / Staff login / Student login / Study Study COURSES...".
    text = re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", raw)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    # The default budget suits prompt context; official_import asks for more,
    # because a fees table can sit well down a long page.
    return text[: max_chars or _PAGE_FETCH_MAX_CHARS]


def _format_search_context(results):
    if not results:
        return "(no search results found — use your best general knowledge, and say so if unsure)"
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r.get('title', '')} — {r.get('href', '')}\n   {r.get('body', '')}")
    return "\n".join(lines)


_STOPWORDS = {"university", "of", "the", "and", "college", "institute", "school"}


def _is_subsequence(needle, haystack):
    it = iter(haystack)
    return all(ch in it for ch in needle)


def _domain_fits_name(href, name):
    """Does this .ac.uk domain plausibly belong to `name`?

    A search for one university routinely surfaces another's page, so the
    first .ac.uk hit is not necessarily the right institution — searching
    "University of Edinburgh fees" can return hw.ac.uk above ed.ac.uk. We
    accept the domain label if it reads like an abbreviation of the name:
    either the initials (hw -> Heriot-Watt, gcu -> Glasgow Caledonian) or a
    subsequence of one significant word (abdn -> Aberdeen, ed -> Edinburgh).
    """
    match = re.search(r"//(?:www\.)?([a-z0-9-]+)\.ac\.uk", href.lower())
    if not match:
        return False
    label = match.group(1).replace("-", "")
    words = _norm_name(name).split()
    if not words or not label:
        return False

    # Real abbreviations disagree about which words count: gcu keeps
    # "University", uws keeps "West", hw drops both. Try each convention.
    variants = [
        words,
        [w for w in words if w not in {"of", "the", "and"}],
        [w for w in words if w not in _STOPWORDS],
    ]
    acronyms = ["".join(w[0] for w in v) for v in variants if v]
    if label in acronyms:
        return True
    # Long names get truncated abbreviations: lse for London School of
    # Economics and Political Science. Require 3+ chars so a stray initial
    # can't match half the sector.
    if len(label) >= 3 and any(a.startswith(label) for a in acronyms):
        return True

    significant = [w for w in words if w not in _STOPWORDS]
    return any(_is_subsequence(label, w) for w in significant)


def _ac_uk_url(results, name=None):
    """A real UK university domain spotted in search results — trusted
    over anything the model claims on its own, since it's observed
    evidence rather than a model guess. When `name` is given, only a domain
    that plausibly belongs to that university is trusted; otherwise we would
    happily hand back a rival's fees page."""
    fallback = None
    for r in results:
        href = r.get("href", "")
        if ".ac.uk" not in href:
            continue
        if name is None:
            return href
        if _domain_fits_name(href, name):
            return href
        if fallback is None:
            fallback = href
    return None if name is not None else fallback


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


def _norm_name(value):
    """Loose key for matching university names: drops parenthetical asides
    like "(Paisley)" and all punctuation, so "St Mary's University, Twickenham"
    and "St Marys University Twickenham" collapse to the same thing."""
    value = re.sub(r"\(.*?\)", " ", value or "")
    # Apostrophes are deleted rather than spaced, so "Mary's" and "Marys"
    # collapse together instead of becoming "mary s" and "marys".
    value = value.replace("'", "").replace("’", "")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.lower()).split())


def _resolve_candidate(model_name, enriched):
    """Map a name Gemini returned back onto the candidate we asked about.
    Returns (canonical_name, enrich_info); falls back to the model's own name
    if nothing matches, so an unexpected extra entry is passed through rather
    than dropped."""
    if not model_name:
        return None, {}
    key = _norm_name(model_name)
    if key:
        for e in enriched:
            if _norm_name(e["name"]) == key:
                return e["name"], e
        for e in enriched:
            other = _norm_name(e["name"])
            if other and (other in key or key in other):
                return e["name"], e
    return model_name, {}


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
    return llm_provider.generate(prompt, system_instruction, temperature)


# Tuition and entry requirements differ sharply between undergraduate and
# postgraduate study, so the level the student picked is spelled out for the
# model rather than passed as a bare "BSc" it might read as a course code.
_LEVEL_PHRASES = {
    "bsc": "BSc/BA undergraduate (bachelor's)",
    "msc": "MSc/MA postgraduate taught (master's)",
}


def _level_phrase(level):
    if not level:
        return ""
    return _LEVEL_PHRASES.get(level.strip().lower(), level)


SEARCH_SYNTHESIS_SYSTEM_INSTRUCTION = (
    "You are a UK higher-education admissions research assistant for "
    "prospective international students, particularly from Bangladesh. "
    "For each university you'll be given a rough existing estimate plus real "
    "evidence (official page text and web search snippets). Facts must come "
    "from that evidence, never from memory: when you state a tuition fee or "
    "an English-language requirement you must also return the exact sentence "
    "from the evidence that supports it, copied verbatim. If the evidence "
    "does not support a figure, return null for it and keep the existing "
    "estimate — an honest gap is worth more than a confident guess. "
    "Respond with ONLY a JSON array, no prose, no markdown fences."
)

# A quote only counts if it actually appears in the evidence we supplied.
# Normalising whitespace, quote marks and case first, because models
# reflow and re-punctuate what they copy even when the substance is exact.
_QUOTE_MIN_CHARS = 12


def _normalise_for_match(text: str) -> str:
    text = (text or "").lower().replace("’", "'").replace("“", '"').replace("”", '"')
    text = text.replace("£", "£").replace("–", "-").replace("—", "-")
    return " ".join(text.split())


def _quote_is_grounded(quote: str, evidence: str) -> bool:
    """Did this sentence really come from the text we handed the model?

    This is the whole anti-invention mechanism: a figure is only accepted if
    its supporting sentence is present in the evidence, so a number recalled
    from training data has nothing to cite and gets dropped."""
    if not quote or len(quote.strip()) < _QUOTE_MIN_CHARS:
        return False
    return _normalise_for_match(quote) in _normalise_for_match(evidence)


def search_universities(gpa, ielts, budget, course, city, candidates, intake=None, level=None):
    """`candidates` is a pre-filtered list of real universities (from our
    own static dataset, matched against the same criteria) to enrich with
    live search data. Sourcing names this way — instead of asking Gemini to
    invent a candidate list — saves a whole Gemini call per search, which
    matters a lot given this API key's very small daily request quota."""
    cache_key = ("search", gpa, ielts, budget, course, city, intake, level)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    criteria = [
        f"HSC/GPA of {gpa} (out of 5.0)" if gpa is not None else None,
        f"IELTS overall band of {ielts}" if ielts is not None else None,
        f"a maximum annual tuition budget of £{budget}" if budget is not None else None,
        f"looking for a {_level_phrase(level)} degree" if level else None,
        f"interested in studying {course}" if course else None,
        f"preferring the city/region of {city}" if city else None,
        f"aiming for the {intake} intake" if intake else None,
    ]
    criteria_text = "; ".join(c for c in criteria if c)

    # The caller (main.py) decides how many to enrich via its ENRICH_LIMIT —
    # it has already ranked and sliced the list, so take it as given.
    named_candidates = [c for c in candidates if c.get("name")]
    if not named_candidates:
        raise ValueError("No candidate universities to enrich")

    def _enrich(c):
        name, city_name = c["name"], c.get("city", "")
        query = (
            f"{name} {city_name} {level or ''} international tuition fees "
            f"IELTS entry requirements {course or ''}"
        ).strip()
        results = _web_search(query, max_results=4)
        # A URL we already trust (persisted from a prior run, or a curated
        # admin edit) is worth reading directly — its actual page text beats
        # a short search snippet of whichever page happened to rank, which
        # is often a generic fees overview rather than this course's page.
        known_url = c.get("official_url") or ""
        page_text = _fetch_page_text(known_url)
        return {
            "name": name,
            "city": city_name,
            "baseline": c,
            "ac_uk_url": _ac_uk_url(results, name) or (known_url or None),
            "best_guess_url": _best_guess_url(results),
            "search_context": _format_search_context(results),
            "known_url": known_url,
            "page_text": page_text,
        }

    with ThreadPoolExecutor(max_workers=min(10, len(named_candidates))) as pool:
        enriched = list(pool.map(_enrich, named_candidates))

    if not enriched:
        raise ValueError("No candidate universities found")

    candidates_block = "\n\n".join(
        f"University: {e['name']} ({e['city']})\n"
        f"Our existing estimate (may be outdated — verify/update using the "
        f"evidence below): tuition £{e['baseline'].get('annual_tuition_gbp')}, "
        f"min GPA {e['baseline'].get('min_gpa')}, min IELTS {e['baseline'].get('min_ielts')}\n"
        + (
            f"Official page content ({e['known_url']}) — this is the university's own site, "
            f"prefer it over the search results below whenever it states a figure:\n{e['page_text']}\n\n"
            if e["page_text"]
            else ""
        )
        + f"Search results:\n{e['search_context']}"
        for e in enriched
    )

    level_note = (
        f", at {_level_phrase(level)} level — the figures and requirements must "
        f"be for that level, not the other one"
        if level
        else ""
    )
    synthesis_prompt = f"""Student profile: {criteria_text or "no specific constraints given"}.

Using the real evidence below for each university — official page content where given, else the
web search results — return a JSON array where each item has exactly these keys:
- "name": string
- "city": string
- "annual_tuition_gbp": number, a representative annual international
  tuition fee in GBP{level_note}
- "tuition_min_gbp": number or null, the LOWEST annual international fee
  the evidence shows for this university
- "tuition_max_gbp": number or null, the HIGHEST annual international fee
  the evidence shows. Fees differ by course, so give the real spread rather
  than repeating one number — null both if the evidence shows only one.
- "tuition_quote": string or null, the exact sentence from the evidence
  above that states the fee, copied word for word. null if the evidence
  does not state a fee.
- "tuition_source_url": string or null, the URL the quote came from
- "min_gpa": number or null, typical minimum HSC/GPA equivalent out of 5.0
  if determinable, else null
- "min_ielts": number, typical minimum IELTS overall band required
- "ielts_quote": string or null, the exact sentence from the evidence that
  states the English requirement, copied word for word
- "ielts_source_url": string or null, the URL that quote came from
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

    results = []
    seen_names = set()
    for item in data:
        # Gemini tends to decorate the name it was handed — "University of X"
        # comes back as "University of X (Paisley)". Resolve it to the exact
        # candidate name, otherwise the caller can't tell that this record and
        # its static counterpart are the same university, and the trusted
        # .ac.uk URL observed in search results never gets matched either.
        name, enrich_info = _resolve_candidate(item.get("name"), enriched)
        if not name or name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        # Everything we actually showed the model for this university. A
        # quote has to be findable in here to be believed.
        evidence = " ".join(
            [enrich_info.get("page_text", ""), enrich_info.get("search_context", "")]
        )
        baseline = enrich_info.get("baseline", {})
        sources = {}

        def _grounded(value, quote_key, url_key, fields):
            """Accept `value` only with a quote we can find in the evidence;
            otherwise fall back to the stored estimate, unattributed."""
            quote = item.get(quote_key)
            if value is None or not _quote_is_grounded(quote, evidence):
                return False
            entry = {
                "quote": quote.strip(),
                "url": _clean_url(item.get(url_key)) or enrich_info.get("ac_uk_url") or "",
                "checked_at": datetime.now(timezone.utc).date().isoformat(),
            }
            for field in fields:
                sources[field] = entry
            return True

        tuition = item.get("annual_tuition_gbp")
        tuition_ok = _grounded(
            tuition, "tuition_quote", "tuition_source_url",
            ["annual_tuition_gbp", "tuition_min_gbp", "tuition_max_gbp"],
        )
        if not tuition_ok:
            tuition = baseline.get("annual_tuition_gbp")

        ielts = item.get("min_ielts")
        ielts_ok = _grounded(ielts, "ielts_quote", "ielts_source_url", ["min_ielts"])
        if not ielts_ok:
            ielts = baseline.get("min_ielts")

        tuition_min = item.get("tuition_min_gbp") if tuition_ok else baseline.get("tuition_min_gbp")
        tuition_max = item.get("tuition_max_gbp") if tuition_ok else baseline.get("tuition_max_gbp")
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
                "annual_tuition_gbp": tuition,
                "tuition_min_gbp": tuition_min,
                "tuition_max_gbp": tuition_max,
                "min_gpa": item.get("min_gpa"),
                "min_ielts": ielts,
                # Which figures above are backed by a quote we verified, and
                # where it came from. Anything missing here is an estimate.
                "field_sources": sources,
                "scholarship": item.get("scholarship", ""),
                "intakes": item.get("intakes", []) or [],
                "courses": item.get("courses", []) or [],
                # Which levels a university teaches is curated data, not
                # something to let the model overwrite — take it from the
                # candidate row we asked about.
                "levels": enrich_info.get("baseline", {}).get("levels", []),
                "why_it_matches": item.get("why_it_matches", ""),
                "official_url": official_url,
                "data_status": (
                    "Live data, figures quoted from source — verify before applying"
                    if sources
                    else "Estimated - no supporting source found in this lookup"
                ),
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


def get_university_details(name, city, course, level=None):
    cache_key = ("details", name, city, course, level)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    query = f"{name} {city or ''} {level or ''} tuition fees entry requirements scholarships application deadlines visa official site".strip()
    results = _web_search(query, max_results=6)
    if not results:
        raise ValueError("No search results found for this university")

    course_line = ""
    if course or level:
        course_line = " for their " + " ".join(
            bit for bit in [level or "", course or ""] if bit
        ) + (" course" if course else " courses")
    level_line = (
        f"\nThe student is asking about {_level_phrase(level)} study — quote "
        f"tuition, entry requirements and deadlines for that level.\n"
        if level
        else ""
    )
    prompt = f"""Using the real web search results below about "{name}" in
{city or 'the UK'}, write a detailed profile for a prospective
international student{course_line}.
{level_line}
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
        _ac_uk_url(results, name)
        or _clean_url(data.get("official_url"))
        or _best_guess_url(results)
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
    # Provider-neutral turn list; llm_provider maps it to each SDK's shape.
    turns = [
        {"role": "assistant" if t.get("role") == "assistant" else "user", "text": t.get("text", "")}
        for t in (history or [])
        if t.get("text")
    ]

    context_lines = []
    profile = (context or {}).get("profile")
    if profile:
        context_lines.append(
            "Student profile — GPA: {gpa}, IELTS: {ielts}, budget: £{budget}/yr, "
            "course interest: {course}, preferred city: {city}, degree level: "
            "{level}, target intake: {intake}.".format(
                gpa=profile.get("gpa") or "not given",
                ielts=profile.get("ielts") or "not given",
                budget=profile.get("budget") or "not given",
                course=profile.get("course") or "not given",
                city=profile.get("city") or "not given",
                level=_level_phrase(profile.get("level")) or "not given",
                intake=profile.get("intake") or "not given",
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

    turns.append({"role": "user", "text": user_message})

    return llm_provider.chat(turns, CHAT_SYSTEM_INSTRUCTION, temperature=0.5)
