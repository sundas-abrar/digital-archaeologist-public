# Digital Archaeologist — Frontend (Phase 1: Skeleton)

## Pages
- `/` — landing page, scroll-through "stratigraphy" of how the tool works
- `/upload` — drag-and-drop zip upload UI (not wired to backend yet)
- `/dashboard` — Overview / Timeline / Findings / File Explorer tabs (empty state until Phase 3–5)
- `/about` — concept explanation
- `/status` — live backend connectivity check, pings FastAPI's `/api/health` every 8s ("No signal" is expected until the backend exists)

## Setup (local machine)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open in your browser: http://localhost:3000

## Changing the backend URL
Change `NEXT_PUBLIC_API_URL` in `.env.local`.

## Next step
The other half of Phase 1: build a FastAPI backend that returns
`{"status": "ok"}` on `GET /api/health`, running on port 8000.
