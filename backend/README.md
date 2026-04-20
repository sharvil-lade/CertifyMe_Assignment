# Backend (Flask API)

## Run

```powershell
python -m pip install -r requirements.txt
python app.py
```

## Environment

Create `.env` in this folder:

```env
SECRET_KEY=your-strong-secret
SUPABASE_DB_URL=your-supabase-postgres-url
```

## Endpoints

- `POST /signup`
- `POST /login`
- `POST /forgot-password`
- `GET /session`
- `POST /logout`
- `GET /opportunities`
- `POST /opportunities`
- `GET /opportunities/<id>`
- `PUT /opportunities/<id>`
- `DELETE /opportunities/<id>`
- `GET /health`
