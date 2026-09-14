# Digital Archaeologist — Frontend (Phase 1: Skeleton)

## Pages
- `/` — landing page, scroll-through "stratigraphy" of how the tool works
- `/upload` — drag-and-drop zip upload UI (not wired to backend yet)
- `/dashboard` — Overview / Timeline / Findings / File Explorer tabs (empty state until Phase 3–5)
- `/about` — concept explanation
- `/status` — live backend connectivity check, pings FastAPI's `/api/health` every 8s ("No signal" is expected until the backend exists)

## Setup (local machine pe)

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Browser mein kholo: http://localhost:3000

## Backend URL badalna ho to
`.env.local` mein `NEXT_PUBLIC_API_URL` change karo.

## Next step
Phase 1 ka doosra half: FastAPI backend banao jo `GET /api/health` par
`{"status": "ok"}` return kare, port 8000 par chale.
