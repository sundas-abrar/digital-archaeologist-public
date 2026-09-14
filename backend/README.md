# Digital Archaeologist — Backend (Phase 1: Skeleton)

## Ye kya karta hai
FastAPI server jo `GET /api/health` route deta hai. Frontend (Next.js)
har 8 seconds mein isko ping karta hai `/status` page pe.

## Setup (local machine pe)

```bash
cd backend
python -m venv venv
```

Windows pe activate karo:
```bash
venv\Scripts\activate
```
Mac/Linux pe:
```bash
source venv/bin/activate
```

Phir:
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Test karo
Browser mein kholo: http://localhost:8000/api/health

Response milna chahiye:
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

## Frontend se connect
Frontend ka `.env.local` already `http://localhost:8000` pe point karta
hai — dono (frontend `npm run dev` + backend `uvicorn`) ek sath chalao,
phir `/status` page pe "Signal confirmed" dikhna chahiye.

## Next step
Phase 2: ZIP upload endpoint jo repo safely extract kare aur file tree
return kare.
