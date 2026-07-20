# UK Uni Match — University Comparison Tool

A small full-stack app: a student enters their GPA, IELTS score, and budget,
and instantly sees which UK universities they're eligible for.

- **Backend:** Python + FastAPI, serving data from an in-memory list (no
  database needed yet — easy to swap in PostgreSQL later).
- **Frontend:** Next.js (App Router) + Tailwind CSS, calling the backend
  with `fetch`.

## Folder structure

```
uni-compare/
├── backend/
│   ├── main.py            # FastAPI app + in-memory university data
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── layout.js
    │   ├── page.js         # the form + results UI
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
  `GET {API_URL}/universities?gpa=...&ielts=...&budget=...` and renders
  whatever the backend returns.

## Next steps (when you're ready)

- Swap the in-memory `UNIVERSITIES` list in `main.py` for real PostgreSQL
  data.
- Add more universities / more accurate fee & requirement data.
- Deploy the backend (Render/Railway) and the frontend (Vercel).
