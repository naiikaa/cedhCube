# cEDHcube - Magic: The Gathering Commander deck collection tracker


Run with:
```bash
    uvicorn app:app --reload --port 8000   (backend API)
    cd frontend && npm run dev             (frontend dev server)
 ```
- Backend API runs on http://localhost:8000
- Frontend dev server runs on http://localhost:5173 (proxies /api to backend)
- For production: build frontend with `cd frontend && npm run build`,
  then serve with uvicorn from `app:app`

## What does it do?
- import Decks via pasted lists or moxfield links
- display overall collection and indicate overlaps in decks
- inspect mana curve and average cmc of decks
