"""cEDHcube - Magic: The Gathering Commander deck collection tracker.

Run with:
    uvicorn app:app --reload --port 8000   (backend API)
    cd frontend && npm run dev             (frontend dev server)
"""
<br>
- Backend API runs on http://localhost:8000
- Frontend dev server runs on http://localhost:5173 (proxies /api to backend)
- For production: build frontend with `cd frontend && npm run build`,
  then serve with uvicorn from `app:app`
