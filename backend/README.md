# Digital Archaeologist — Backend (Phase 1: Skeleton)

## What this does
A FastAPI server that provides the `GET /api/health` route. The
frontend (Next.js) pings it every 8 seconds from the `/status` page.

## Setup (local machine)

```bash
cd backend
python -m venv venv
```

Activate it on Windows:
```bash
venv\Scripts\activate
```
On Mac/Linux:
```bash
source venv/bin/activate
```

Then:
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Testing it
Open in your browser: http://localhost:8000/api/health

You should get this response:
```json
{"status": "ok", "service": "digital-archaeologist-backend", "timestamp": "..."}
```

Interactive API docs (FastAPI auto-generates): http://localhost:8000/docs

## AI interpretation (Phase 5)
`GET /api/interpret/{session_id}` sends structured evidence (file stats,
code stats, git patterns, findings — no raw source code) to Groq to
reconstruct the project's story.

```bash
cp .env.example .env
# then edit .env and paste your key from https://console.groq.com/keys
```

Without a key, the endpoint still responds (200) with
`"available": false` and an explanation, so the UI degrades gracefully.

## Connecting to the frontend
The frontend's `.env.local` already points to `http://localhost:8000` —
run both (frontend `npm run dev` + backend `uvicorn`) at the same time,
and the `/status` page should then show "Signal confirmed".

## Next step
Phase 2: a ZIP upload endpoint that safely extracts the repo and
returns the file tree.
