# Digital Archaeologist

Upload an old project (a ZIP, or a batch of loose files) and an agent
investigates it: plans the dig, extracts evidence, analyzes it, checks
for contradictions, runs whatever tests still work, and reconstructs
the story — with every claim traceable back to a specific file. You can
also hand it your own goal in **Agent Mode** and watch the full
pipeline run live, step by step.

## Structure

```
digital-archaeologist/
├── backend/    FastAPI — upload, scanning, findings engine, AI
│               interpretation (Groq), QA test runner, report/PDF export
└── frontend/   Next.js — upload flow, dashboard (Overview, Agent Mode,
                Investigation, Timeline, Code Evolution, Findings,
                Testing/QA, Files, Help Us Improve)
```

## Setup

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # Mac/Linux
pip install -r requirements.txt
cp .env.example .env        # add your GROQ_API_KEY (optional — falls back gracefully without one)
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000. See `backend/README.md` and
`frontend/README.md` for more detail on each side.

## Notes for contributors

- `.env` files are gitignored on purpose — never commit real API keys.
  Copy the `.env.example` files and fill in your own.
- `backend/storage/` holds runtime-uploaded project data and is
  gitignored (only `.gitkeep` is tracked).
- Work in feature branches and open a pull request into `main` rather
  than pushing directly, to avoid stepping on each other's changes.
