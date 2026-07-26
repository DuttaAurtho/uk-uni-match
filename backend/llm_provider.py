"""Provider-neutral LLM calls, so the app can run on Gemini or Claude.

Everything above this layer (prompt building, web search, JSON extraction,
caching) is shared — only the model call itself differs. Pick a provider with
LLM_PROVIDER=gemini|claude in the environment.

Gemini's free tier caps at ~20 requests/day per model, which this app exhausts
quickly. Claude is pay-per-use with no daily cap, so it costs money but doesn't
stop working partway through a day.
"""

import os

from dotenv import load_dotenv

load_dotenv()

# All app config lives under LLM_*. Don't use a CLAUDE_* prefix here — the
# Claude Code CLI sets CLAUDE_EFFORT and friends in the environment, so those
# names get silently overridden when the app runs from that shell.
PROVIDER = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()

_DEFAULT_MODELS = {"gemini": "gemini-flash-latest", "claude": "claude-opus-5"}

# LLM_MODEL overrides whichever provider is active. GEMINI_MODEL is still
# honoured so existing .env files keep working.
MODEL = (
    os.environ.get("LLM_MODEL")
    or (os.environ.get("GEMINI_MODEL") if PROVIDER == "gemini" else None)
    or _DEFAULT_MODELS.get(PROVIDER, _DEFAULT_MODELS["gemini"])
)

# This workload is structured extraction from snippets we already supply, not
# open-ended reasoning, so it doesn't need deep thinking. Low effort keeps cost
# and latency down. Raise it if answer quality suffers. (Claude only.)
EFFORT = os.environ.get("LLM_EFFORT", "low").strip().lower()

# Comfortably above the ~2k tokens a 10-university JSON payload needs. On
# Claude this budget covers thinking *and* the reply, so leave headroom.
MAX_TOKENS = 16000

_gemini_client = None
_claude_client = None


def active_provider() -> str:
    return PROVIDER


def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        from google import genai

        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


_MISSING_CREDS = (
    "LLM_PROVIDER=claude but no Anthropic credentials found. Set "
    "ANTHROPIC_API_KEY in backend/.env (get one at console.anthropic.com)."
)


def _get_claude():
    global _claude_client
    if _claude_client is None:
        import anthropic

        # The SDK resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an
        # `ant auth login` profile, so don't check the key by hand — but note
        # it constructs lazily and only fails on the first request, which is
        # why the translation happens in _claude_call, not here.
        _claude_client = anthropic.Anthropic()
    return _claude_client


def _claude_call(**kwargs):
    """Send a Claude request, translating a missing-credentials failure into a
    message that names the fix. main.py catches everything and silently falls
    back to estimated data, so an opaque error here would be invisible."""
    try:
        return _get_claude().messages.create(**kwargs)
    except TypeError as exc:
        if "authentication" in str(exc).lower():
            raise RuntimeError(_MISSING_CREDS) from exc
        raise


def _claude_text(response) -> str:
    """Concatenate the text blocks of a Claude response.

    `content` is a list of typed blocks — with thinking enabled the first one
    is a thinking block, so indexing [0].text would return the wrong thing (or
    nothing). Filter by type instead.
    """
    if response.stop_reason == "refusal":
        raise ValueError("Claude declined this request")
    parts = [b.text for b in response.content if b.type == "text"]
    if not parts:
        raise ValueError("Empty response from Claude")
    return "".join(parts)


def generate(prompt: str, system_instruction: str, temperature: float = 0.3) -> str:
    """One-shot completion. Returns the model's text."""
    if PROVIDER == "claude":
        response = _claude_call(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_instruction,
            output_config={"effort": EFFORT},
            messages=[{"role": "user", "content": prompt}],
        )
        return _claude_text(response)

    from google.genai import types

    response = _get_gemini().models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )
    if not response.text:
        raise ValueError("Empty response from Gemini")
    return response.text


def chat(messages, system_instruction: str, temperature: float = 0.5) -> str:
    """Multi-turn reply. `messages` is [{"role": "user"|"assistant", "text": ...}]
    — a provider-neutral shape both SDKs are built from here."""
    turns = [m for m in messages if m.get("text")]
    if not turns:
        raise ValueError("No messages to send")

    if PROVIDER == "claude":
        response = _claude_call(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_instruction,
            output_config={"effort": EFFORT},
            messages=[{"role": m["role"], "content": m["text"]} for m in turns],
        )
        return _claude_text(response).strip()

    from google.genai import types

    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["text"])],
        )
        for m in turns
    ]
    response = _get_gemini().models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )
    if not response.text:
        raise ValueError("Empty response from Gemini")
    return response.text.strip()
