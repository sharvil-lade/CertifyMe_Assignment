# Deployment Guide - Vercel

## Prerequisites
- GitHub account with this repository
- Vercel account
- PostgreSQL/Supabase database for production (recommended)

## Frontend
1. Import the repository in Vercel.
2. Keep framework as Vite.
3. `VITE_API_URL` is optional and defaults to `/api`.

## Backend
- Serverless function entrypoint is `api/index.py`.
- Requests to `/api/*` are rewritten to that function in `vercel.json`.

### Environment Variables (Vercel)
- `SECRET_KEY` (required)
- `SUPABASE_DB_URL` (recommended for persistent production data)

Notes:
- If `SUPABASE_DB_URL` is not set on Vercel, fallback DB is `/tmp/admin_portal.db` (ephemeral).

## Local Development
```bash
# frontend
cd frontend
npm install
npm run dev

# backend (new terminal)
cd backend
pip install -r requirements.txt
python app.py
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`

Optional local override:
- `VITE_API_PROXY_TARGET` (defaults to `http://localhost:5000`)
