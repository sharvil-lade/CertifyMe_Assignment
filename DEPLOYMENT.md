# Deployment Guide - Vercel

## Prerequisites
- GitHub account with the repository linked
- Vercel account (free tier available at vercel.com)
- Supabase or PostgreSQL database (optional, for production)

## Frontend Deployment

1. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel auto-detects Vite configuration
   - Click Deploy

2. **Configure Environment Variables:**
   - In Vercel dashboard: Project Settings → Environment Variables
   - Add: `VITE_API_URL` = `/api` (for local Vercel API) or your API URL

## Backend Deployment

The backend is deployed as Vercel Serverless Functions in the `/api` directory.

1. **Environment Variables (Set in Vercel):**
   - `SECRET_KEY`: Generate a secure secret (use `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
   - `SUPABASE_DB_URL`: Your PostgreSQL database URL (from Supabase or other provider)
   - `FLASK_ENV`: production

2. **Database Setup:**
   - For local development: Uses SQLite (auto-created)
   - For production: Set up PostgreSQL/Supabase
   - Create tables:
     ```bash
     cd backend
     python -c "from app import app, db; app.app_context().push(); db.create_all()"
     ```

## Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (in another terminal)
cd backend
pip install -r requirements.txt
python app.py
```

Frontend runs on http://localhost:5173
Backend runs on http://localhost:5000

## File Structure for Vercel

```
CertifyMe_Assignment/
├── vercel.json                 (Vercel configuration)
├── api/
│   ├── index.py               (Serverless function entry point)
│   └── requirements.txt        (Python dependencies)
├── frontend/
│   ├── src/
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example
```

## Deployment Steps

1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Setup Vercel deployment"
   git push
   ```

2. Vercel auto-deploys on push to main branch

3. Monitor deployment: https://vercel.com/dashboard

## Troubleshooting

- **API not responding:** Check `SUPABASE_DB_URL` environment variable
- **CORS errors:** Verify CORS is enabled in `backend/app.py`
- **Build fails:** Check `frontend/package.json` and `api/requirements.txt`
- **Database errors:** Ensure PostgreSQL connection string is correct

## Costs

- **Vercel:** Free tier includes 100GB bandwidth/month
- **Database:** Use Supabase free tier (500 MB storage) or similar
