# Admin Portal Monorepo

This project is split into:

- `backend/` - Flask API (authentication + opportunity CRUD)
- `frontend/` - React (Vite) UI

## 1) Backend setup

```powershell
cd backend
python -m pip install -r requirements.txt
```

Create `backend/.env` (or copy `backend/.env.example`) with:

```env
SECRET_KEY=your-strong-secret
SUPABASE_DB_URL=your-supabase-postgres-connection-string
```

Run backend:

```powershell
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

## 2) Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173` and proxies API calls to `http://127.0.0.1:5000`.
