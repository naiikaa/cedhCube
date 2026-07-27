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

# Import Decks via List or Moxfield Links
<img width="2054" height="1565" alt="Screenshot_2026-06-30_19-13-09" src="https://github.com/user-attachments/assets/f5df9a82-b6d8-4910-8955-6ee77ad6f37b" />

# Edit decks, set commanders, remove or add cards
<img width="1395" height="1639" alt="Screenshot_2026-06-30_19-12-04" src="https://github.com/user-attachments/assets/de082310-88fb-4b89-bbb2-da0b9ac77c80" />

# View your entire collection and see what overlap is present across your decks
<img width="3051" height="1973" alt="Screenshot_2026-06-30_19-11-39" src="https://github.com/user-attachments/assets/ca5cd53a-e250-4810-a9fa-f078f11b2a8e" />
