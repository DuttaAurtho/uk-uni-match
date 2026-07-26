# UK Uni Match — University Comparison Tool

A small full-stack app: a student enters their GPA, IELTS score, and budget,
and instantly sees which UK universities they're eligible for, backed by a
live, Gemini-powered search (grounded with free DuckDuckGo web search) with
an offline fallback dataset, a per-university detail lookup, and a chat
assistant.

- **Backend:** Python + FastAPI. `/universities` calls Gemini (using real
  web search snippets for grounding) for live matches; if that fails for
  any reason it falls back to the bundled static dataset so the app never
  dead-ends.
- **Frontend:** Next.js (App Router) + Tailwind CSS, calling the backend
  with `fetch`.

## Folder structure

```
uni-compare/
├── backend/
│   ├── main.py             # FastAPI routes (search/details/chat + fallback)
│   ├── gemini_client.py    # Gemini prompts, web search, parsing, caching
│   ├── universities_data.json  # offline fallback dataset
│   ├── .env                # GEMINI_API_KEY / GEMINI_MODEL (gitignored)
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── layout.js
    │   ├── page.js         # the form + results UI
    │   ├── components/      # Header, Hero, MatchForm, ResultsList,
    │   │                     # UniversityDetailModal, ChatWidget, ...
    │   └── globals.css
    └── .env.local          # points the frontend at the backend URL
```

## 1. Run the backend

Open a terminal in VS Code:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:
- Windows (PowerShell): `venv\Scripts\Activate.ps1`
- Mac/Linux: `source venv/bin/activate`

Copy `.env.example` to `.env` and paste in a Gemini API key from
[Google AI Studio](https://aistudio.google.com/apikey):

```bash
cp .env.example .env
```

```
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-flash-latest
```

Notes on the Gemini setup:
- Google Search *grounding* (Gemini's own built-in search tool) requires a
  billing-enabled project even on the "free" tier — if you don't have that,
  this app doesn't need it: real-time facts instead come from a free,
  keyless DuckDuckGo search whose results are fed to Gemini as context.
- Free-tier Gemini keys can have a **very small daily request quota**
  (as low as 20 requests/day depending on the model and project). Each
  search/detail view/chat message uses 1 request. If you hit a 429 error,
  that's this daily cap, not a bug — it resets after ~24h, or you can
  enable billing for a much higher limit.
- Without a working key at all, the app still runs fine using the offline
  fallback dataset (search results are just labeled accordingly).

Then install dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`.
Test it by opening **http://localhost:8000/universities?gpa=4&ielts=6&budget=15000**
in your browser — you should see JSON data.

## 2. Run the frontend

Open a **second terminal** (keep the backend running in the first one):

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser. Fill in the form and click
**Find my universities** — it calls the backend and shows matching
universities live.

## How the sync works

- The backend enables CORS for `http://localhost:3000` in `main.py`, so the
  browser is allowed to call it from the frontend's origin.
- The frontend reads the backend's address from `NEXT_PUBLIC_API_URL` (set
  in `frontend/.env.local`, currently `http://localhost:8000`).
- On form submit, the frontend calls
  `GET {API_URL}/universities?gpa=...&ielts=...&budget=...`. The response
  includes `"source": "gemini"` or `"source": "fallback"` so the UI can show
  a small note when live data wasn't available.
- Clicking a university card calls `POST /universities/details` for a
  deeper, Gemini-researched profile (entry requirements, tuition breakdown,
  scholarships, visa notes, and the official admissions link).
- The chat widget calls `POST /chat` with the running conversation plus the
  student's search profile and (if open) the selected university, so it can
  answer contextually without the user re-explaining themselves.

## Known limitation: the fallback dataset

`universities_data.json` currently ships with ~56 real UK universities as a
functional placeholder — it is **not** the original 157-university dataset
that was previously sourced from a spreadsheet (that file was lost when the
project's git history was reset and had never been committed since being
regenerated). If you still have that original spreadsheet, it can be
re-imported to restore the full dataset; otherwise this smaller set still
works fully as both the offline fallback and the source of real candidate
names for the live Gemini search.

## Next steps (when you're ready)

- Re-import the original 157-university spreadsheet if you still have it.
- Persist chat history / favorited universities per user (currently
  everything is in-memory / client-side only).
- Swap the file-based fallback dataset for a real database.
- Deploy the backend (Render/Railway) and the frontend (Vercel), remembering
  to set `GEMINI_API_KEY` as a server-side secret on whichever host you use.
