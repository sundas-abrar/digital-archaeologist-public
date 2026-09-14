# Deploying Digital Archaeologist

Two services: the Next.js **frontend** and the FastAPI **backend**. They
deploy separately and talk to each other over HTTPS.

## 0. Before you deploy — read this

This app can **execute uploaded code** (Testing/QA panel, Agent Mode).
This deployment is public with no password gate, so anyone with the
link can upload a project and run its commands on your server. That's
fine for a demo/portfolio project, just be aware of it — don't point
it at anything sensitive, and keep an eye on Railway's usage if it
gets shared widely.

Also note: uploaded archives are stored on local disk
(`backend/storage/`). On most free hosting tiers that storage doesn't
survive a redeploy or restart — fine for demos, not for anything you
need to keep long-term.

---

## 1. Push to GitHub

Both `frontend/` and `backend/` can live in one repo. Each hosting step
below points at the same repo but a different **root directory**.

```bash
git init
git add .
git commit -m "Digital Archaeologist"
git remote add origin <your-repo-url>
git push -u origin main
```

(Make sure `.gitignore` in both `frontend/` and `backend/` is in place
so `node_modules`, `venv`, `.next`, and `storage/` don't get committed
— they already are in this project.)

---

## 2. Deploy the backend (Railway)

[Railway](https://railway.app) is the simplest option for a FastAPI app
that needs a persistent-ish process (not a serverless function) and
lets you run shell commands via subprocess (Vercel's serverless
functions can't do this reliably).

1. New Project → Deploy from GitHub repo → pick this repo.
2. Set **Root Directory** to `backend`.
3. Railway auto-detects Python. If it asks for a start command, use
   what's in `backend/Procfile`:
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables (Railway → Variables):
   - `GROQ_API_KEY` — your key from console.groq.com/keys (optional,
     enables real AI narratives instead of the template fallback)
   - `ALLOWED_ORIGINS` — leave blank for now, come back after step 3.
5. Deploy. Railway gives you a URL like `https://your-app.up.railway.app`.
   **Copy it.**
6. Visit `https://your-app.up.railway.app/api/health` — you should see
   `{"status": "ok", ...}`.

(Render is a fine alternative — same idea: root directory `backend`,
build command `pip install -r requirements.txt`, start command from
`Procfile`, same environment variables. Render's free tier may ask for
card verification on some accounts; Railway generally doesn't.)

---

## 3. Deploy the frontend (Vercel)

1. [vercel.com](https://vercel.com) → New Project → import the same
   GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Next.js (auto-detected).
4. Add an environment variable (Vercel → Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = the Railway URL from step 2
     (e.g. `https://your-app.up.railway.app`)
5. Also check **Settings → Deployment Protection** on Vercel itself and
   make sure it's off (or set to "Only Preview Deployments") — that
   setting is separate from this app and, if left on, will block public
   visitors with a Vercel login wall even though the app has none.
6. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`.

---

## 4. Connect them: allow the frontend's origin on the backend

Go back to Railway → Variables → set:

```
ALLOWED_ORIGINS=https://your-app.vercel.app
```

(Comma-separate multiple origins if you also have a custom domain.)
Redeploy/restart the backend service for this to take effect.

---

## 5. Test it

1. Open your Vercel URL — it should load straight into the app, no
   login/password screen.
2. Upload a small `.zip`, run it through the dashboard, try the
   Testing/QA and Agent Mode tabs.
3. If something fails with a network/CORS error, double check
   `NEXT_PUBLIC_API_URL` (frontend) and `ALLOWED_ORIGINS` (backend)
   match exactly, including `https://` and no trailing slash.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| CORS error in the browser console | `ALLOWED_ORIGINS` on the backend doesn't include your exact Vercel URL |
| A login/password wall appears | That's Vercel's own **Deployment Protection** setting, not this app — turn it off in Vercel project settings |
| Findings/QA/Agent work locally but nothing happens when deployed | The uploaded session's files were on a previous instance/restart and got wiped — re-upload |
| "groq package isn't installed" or AI features silently fall back | `GROQ_API_KEY` isn't set on Railway, or `requirements.txt` didn't install `groq` — check the Railway build logs |
