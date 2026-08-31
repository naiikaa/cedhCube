# Partner / Two-Commander Support

## Goal
Support decks with two commanders (Partner, Partner With, Friends Forever, Choose a Background, or any other "can have two commanders" mechanic). Currently the entire stack (DB schema, Scryfall auto-detect on deck creation, Moxfield import, frontend picker/display) hard-codes a single `commander_name`/`commander_image_url`.

## 1. Database (`database.py`)
- Add two new nullable columns via additive migration (follow the existing `ALTER TABLE ... IF NOT EXISTS` pattern already used for `commander_name`/`commander_image_url`/`is_foil`):
  - `commander2_name TEXT DEFAULT ''`
  - `commander2_image_url TEXT DEFAULT ''`
- `update_deck_commander(deck_id, commander_name, commander_image_url)` → extend to `update_deck_commander(deck_id, commander_name, commander_image_url, commander2_name='', commander2_image_url='')`. Keep backward-compatible defaults so existing call sites without the 2nd commander still work.
- `get_decks_missing_commander_images()`: extend to also find decks with `commander2_name` set but `commander2_image_url` empty, matching on `dc.card_name = d.commander2_name` too (union or a second query — keep it simple, a second query merged into the same return list is fine).
- `update_deck_commander_image(deck_id, image_url)`: this currently always updates the first commander's image column. Add an optional `slot` param (`1` or `2`, default `1`) that picks which column to update, OR add a sibling `update_deck_commander2_image(deck_id, image_url)`. Pick whichever is less invasive to existing call sites.

## 2. Scryfall-side commander detection (`app.py` — `api_add_deck`, manual deck creation)
Currently: first legendary creature encountered while parsing the card list becomes the sole commander.

New logic: collect ALL legendary creatures parsed. Then:
- If a card's oracle text contains "Partner with" → that's its explicit partner; if BOTH named cards are present in the parsed list, pair them as commander 1 + 2 regardless of order encountered. (Oracle text needed — you may need to fetch it via `scryfall.py`'s existing lookup; check what fields `validate_and_resolve_card` already returns, and only add an oracle_text fetch if not already present. If oracle text isn't already returned by `validate_and_resolve_card`, it's fine to skip "Partner with"-specific pairing and fall back to the general rule below — don't overengineer a second Scryfall round-trip if avoidable.)
- General fallback rule: if exactly two legendary creatures are found and at least one of them has "Partner" (generic, not "Partner with") or "Choose a Background" or "Friends forever" in its type/oracle text, set both as commander 1 and commander 2. If that text isn't available cheaply, a pragmatic fallback: if exactly 2 legendary creatures are in the list, set both as co-commanders (most cEDH decks with 2 legendary creatures ARE partner pairs — false positive rate is low and the user can correct manually via the picker described below).
- If only 1 legendary creature found → single commander as today (no behavior change).
- If 3+ legendary creatures found → keep today's behavior (first one wins) since we can't safely guess; user can fix via the commander picker after creation.

## 3. Moxfield import (`app.py` — `api_import_deck`, `moxfield.py` — `fetch_moxfield_deck`)
Moxfield's API already returns a `commanders` dict which can contain 1 or 2 entries — this is the reliable source, no guessing needed.
- `fetch_moxfield_deck()`: return `commander_name`/`commander_image_url` for the first entry (unchanged) AND add `commander2_name`/`commander2_image_url` for the second entry if `len(commanders) >= 2`, else empty strings.
- `api_import_deck`: pass both through to `update_deck_commander(...)`, and include both scryfall_ids in the background image-fetch thread (`_fetch_and_save_images` needs a second commander scryfall_id + image param — extend its signature, keep it backward compatible with a default).

## 4. API routes (`app.py`)
- `UpdateCommanderRequest` Pydantic model: add `commander2_name: str = ""`, `commander2_image_url: str = ""`.
- `PUT /api/decks/{deck_id}/commander`: pass all 4 fields through to `update_deck_commander`.
- Response shapes (`get_decks`, `get_deck`) already do `SELECT *` / `dict(r)` so the new columns will automatically appear in JSON — no route changes needed there, just confirm.

## 5. Frontend types (`frontend/src/lib/types.ts`)
- Add `commander2_name: string` and `commander2_image_url: string` to the `Deck` type (and anywhere `Card` distinguishes commander status if applicable).

## 6. Frontend UI (`frontend/src/App.tsx`, `Header.tsx` if relevant)
- **Deck list row**: when a deck has both commanders, show both thumbnails side by side (small, same treatment as today's single commander thumbnail — thin `--commander` ring) and both names (e.g. "Commander A // Commander B" or stacked on two lines if it fits better — use judgement, keep it compact, don't break the row layout for single-commander decks).
- **Deck modal header/commander section**: show both commanders when present, same visual treatment (crown icon, `--commander` color) for each.
- **Commander picker** (`showCommanderPicker` UI, currently single-select from `legendaryCreatures`): change to allow selecting UP TO 2 commanders. Suggested UX: clicking a legendary creature toggles it in/out of a selected set (max 2 — selecting a 3rd replaces the oldest selection, or simply disable further clicks until one is deselected — your call, keep it simple and discoverable). Show selected state clearly (checkmark or highlighted border) for each of up to 2 chosen cards. A "Clear" option removes both. Call `setCommander` with both when 2 are picked, or just commander 1 when only 1 is picked (clear commander 2's fields).
- Update `setCommander` (the API-calling function) to accept and send both commander fields.
- **Card detail modal / anywhere else `commander_name` is referenced**: check for any other single-commander assumptions (search the codebase) and extend consistently.

## Non-negotiables
- Fully backward compatible: existing single-commander decks continue to work with `commander2_name` empty — never show a second commander slot's UI (thumbnail, ring, name) when it's empty.
- No breaking changes to existing API contracts beyond additive optional fields.
- `npm run build` must stay clean (TS errors on `Deck` type usage would surface immediately).
- Test manually against the running dev servers (`~/magic-collection`, backend :8000 venv already set up at `./venv`, frontend :5173) — create a test deck with 2 known partner commanders (e.g. "Ravos, Dralnu's Heir" + "Tymna the Weaver", a classic partner pair) via the manual creation textarea, confirm both are detected and both display correctly. Also test the manual commander picker UI end-to-end (select 2, select 1, clear).
- Commit with git as you go, don't push.

## Acceptance checklist
- [ ] DB migration adds `commander2_name`/`commander2_image_url` cleanly on existing `collection.db` (no data loss, additive only)
- [ ] Manual deck creation with 2 legendary creatures auto-assigns both as co-commanders
- [ ] Moxfield import correctly pulls both commanders when the source deck has 2
- [ ] Deck list row shows both commander thumbnails/names when present, unchanged single-commander layout otherwise
- [ ] Deck modal shows both commanders
- [ ] Commander picker supports selecting/clearing up to 2 commanders
- [ ] `npm run build` succeeds with no TS errors
- [ ] Existing single-commander decks unaffected (spot check in the running app)
