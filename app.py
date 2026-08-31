"""FastAPI backend for cEDHcube."""
import re
import threading
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from database import (
    init_db, add_deck, get_decks, get_deck, rename_deck, delete_deck,
    add_card_to_deck, get_deck_cards, update_card, delete_card,
    clear_deck_cards, get_collection, get_db, get_deck_color_identity,
    update_deck_color, update_deck_commander,
    get_cards_missing_images, update_card_image,
    get_decks_missing_commander_images, update_deck_commander_image,
    get_deck_cmc_distribution,
)
from scryfall import parse_card_list, validate_and_resolve_card, lookup_card, fetch_card_detail
from moxfield import fetch_moxfield_deck, extract_deck_id, fetch_card_images_bulk

app = FastAPI(title="cEDHcube")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ───

class CreateDeckRequest(BaseModel):
    name: str
    card_list: str = ""
    color: Optional[str] = None

class RenameDeckRequest(BaseModel):
    name: str

class UpdateColorRequest(BaseModel):
    color: str

class UpdateCommanderRequest(BaseModel):
    commander_name: str = ""
    commander_image_url: str = ""
    commander2_name: str = ""
    commander2_image_url: str = ""

class AddCardsRequest(BaseModel):
    card_list: str

class UpdateCardRequest(BaseModel):
    quantity: Optional[int] = None
    set_code: Optional[str] = None
    card_name: Optional[str] = None
    is_foil: Optional[int] = None
    scryfall_id: Optional[str] = None
    image_url: Optional[str] = None
    mana_cost: Optional[str] = None
    colors: Optional[list] = None
    color_identity: Optional[list] = None
    cmc: Optional[float] = None
    type_line: Optional[str] = None

class ImportDeckRequest(BaseModel):
    url: str
    color: Optional[str] = None

# ─── Commander Detection ───

# "Partner with <Name>" is followed by reminder text in parentheses, so the name
# runs to the first '(' or end of line. Card names may contain commas.
_PARTNER_WITH_RE = re.compile(r"partner with ([^\n(]+)", re.I)

# Mechanics that allow a second commander.
_PARTNER_MECHANICS = (
    "partner", "choose a background", "friends forever", "doctor's companion",
    "background",  # Backgrounds themselves are "Legendary Enchantment — Background"
)


def _card_text(card):
    return f"{card.get('type_line') or ''}\n{card.get('oracle_text') or ''}".lower()


def _is_legendary_creature(card):
    tl = (card.get("type_line") or "").lower()
    return "legendary" in tl and "creature" in tl


def _is_background(card):
    return "background" in (card.get("type_line") or "").lower()


def _has_partner_mechanic(card):
    text = _card_text(card)
    return any(k in text for k in _PARTNER_MECHANICS)


def _name_matches(card, wanted):
    """Match a Scryfall card against a name, tolerating '//' double-faced names."""
    name = (card.get("name") or "").lower()
    wanted = wanted.lower()
    return name == wanted or name.startswith(wanted + " //")


def detect_commanders(cards):
    """Pick up to two commanders from resolved Scryfall card dicts.

    Returns (commander, commander2) where each is a resolved card dict or None.
    Order follows the card list, so slot 1 stays what it was before partner
    support for single-commander decks.
    """
    legends = [c for c in cards if _is_legendary_creature(c)]
    if not legends:
        return None, None

    # 1. Explicit "Partner with X" — pair only when both halves are present.
    for card in legends:
        for match in _PARTNER_WITH_RE.finditer(card.get("oracle_text") or ""):
            wanted = match.group(1).strip(" .")
            mate = next((c for c in legends if c is not card and _name_matches(c, wanted)), None)
            if mate:
                pair = [c for c in legends if c is card or c is mate]
                return pair[0], pair[1]

    # 2. "Choose a Background" — the partner is a legendary Background enchantment.
    background = next((c for c in cards if _is_background(c) and not _is_legendary_creature(c)), None)
    if background:
        chooser = next((c for c in legends if "choose a background" in _card_text(c)), None)
        if chooser:
            return chooser, background

    # 3. Exactly two legendary creatures where one carries a partner mechanic.
    if len(legends) == 2 and (_has_partner_mechanic(legends[0]) or _has_partner_mechanic(legends[1])):
        return legends[0], legends[1]

    # 4. Otherwise (single legend, or 3+ with no safe guess) the first one wins.
    return legends[0], None


# ─── Background Image Refresh ───

def refresh_all_images():
    missing = get_cards_missing_images()
    if missing:
        scryfall_ids = [c["scryfall_id"] for c in missing]
        id_to_url = fetch_card_images_bulk(scryfall_ids)
        for card in missing:
            url = id_to_url.get(card["scryfall_id"])
            if url:
                update_card_image(card["id"], url)
    missing_cmd = get_decks_missing_commander_images()
    if missing_cmd:
        scryfall_ids = [c["scryfall_id"] for c in missing_cmd]
        id_to_url = fetch_card_images_bulk(scryfall_ids)
        for entry in missing_cmd:
            url = id_to_url.get(entry["scryfall_id"])
            if url:
                update_deck_commander_image(entry["deck_id"], url, slot=entry.get("slot", 1))

def _fetch_and_save_images(deck_id, scryfall_ids, cmd_name, cmd_sf_id,
                           cmd2_name=None, cmd2_sf_id=None):
    id_to_url = fetch_card_images_bulk(scryfall_ids)
    card_rows = get_deck_cards(deck_id)
    scryfall_to_db_id = {c["scryfall_id"]: c["id"] for c in card_rows if c.get("scryfall_id")}
    for scryfall_id, image_url in id_to_url.items():
        card_db_id = scryfall_to_db_id.get(scryfall_id)
        if card_db_id and image_url:
            update_card_image(card_db_id, image_url)
    for slot, (name, sf_id) in enumerate(((cmd_name, cmd_sf_id), (cmd2_name, cmd2_sf_id)), start=1):
        if name and sf_id:
            cmd_image = id_to_url.get(sf_id, "")
            if cmd_image:
                update_deck_commander_image(deck_id, cmd_image, slot=slot)

# ─── Startup ───

@app.on_event("startup")
def startup():
    init_db()

# ─── Deck Routes ───

@app.get("/api/decks")
def api_decks():
    return get_decks()

@app.post("/api/decks")
def api_add_deck(req: CreateDeckRequest):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "Deck name is required")
    existing = get_decks()
    if any(d["name"].lower() == name.lower() for d in existing):
        raise HTTPException(409, "A deck with this name already exists")

    deck_id = add_deck(name, color=req.color or None)
    results = []
    resolved_cards = []

    if req.card_list.strip():
        parsed = parse_card_list(req.card_list)
        if not parsed:
            return {"id": deck_id, "name": name, "results": []}
        for quantity, card_name, set_code in parsed:
            resolved = validate_and_resolve_card(card_name, set_code)
            if resolved:
                add_card_to_deck(
                    deck_id, card_name=resolved["name"], quantity=quantity,
                    set_code=resolved["set_code"], scryfall_id=resolved["scryfall_id"],
                    image_url=resolved["image_url"], mana_cost=resolved.get("mana_cost", ""),
                    colors=resolved.get("colors", []), color_identity=resolved.get("color_identity", []),
                    cmc=resolved.get("cmc", 0), type_line=resolved.get("type_line", ""),
                )
                resolved_cards.append(resolved)
                results.append({"status": "ok", "requested": card_name, "resolved": resolved["name"], "quantity": quantity, "image_url": resolved["image_url"]})
            else:
                add_card_to_deck(deck_id, card_name=card_name, quantity=quantity, set_code=set_code or "")
                results.append({"status": "not_found", "requested": card_name, "quantity": quantity})

    commander, commander2 = detect_commanders(resolved_cards)
    if commander:
        update_deck_commander(
            deck_id, commander["name"], commander["image_url"],
            commander2["name"] if commander2 else "",
            commander2["image_url"] if commander2 else "",
        )

    return {"id": deck_id, "name": name, "results": results}

@app.post("/api/decks/import")
def api_import_deck(req: ImportDeckRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(400, "Moxfield URL is required")

    public_id = extract_deck_id(url)
    if not public_id:
        raise HTTPException(400, "Could not extract a Moxfield deck ID")

    moxfield_deck = fetch_moxfield_deck(public_id)
    if not moxfield_deck:
        raise HTTPException(404, "Could not fetch deck from Moxfield")

    name = moxfield_deck["name"]
    existing = get_decks()
    if any(d["name"].lower() == name.lower() for d in existing):
        raise HTTPException(409, f'A deck with the name "{name}" already exists')

    deck_id = add_deck(name, color=req.color or None)
    results = []
    cmd_name = moxfield_deck.get("commander_name")
    cmd2_name = moxfield_deck.get("commander2_name")
    cmd_sf_id = None
    cmd2_sf_id = None
    all_scryfall_ids = []

    for entry in moxfield_deck["cards"]:
        quantity, card_name, set_code, scryfall_id, _, mana_cost, type_line, colors, color_identity, cmc, is_foil = entry
        add_card_to_deck(
            deck_id, card_name=card_name, quantity=quantity, set_code=set_code,
            scryfall_id=scryfall_id, mana_cost=mana_cost, colors=colors,
            color_identity=color_identity, cmc=cmc, type_line=type_line, is_foil=is_foil,
        )
        if scryfall_id:
            all_scryfall_ids.append(scryfall_id)
        if card_name == cmd_name:
            cmd_sf_id = scryfall_id
        if cmd2_name and card_name == cmd2_name:
            cmd2_sf_id = scryfall_id
        results.append({"status": "ok", "requested": card_name, "resolved": card_name, "quantity": quantity})

    if cmd_name:
        update_deck_commander(deck_id, cmd_name, "", cmd2_name or "", "")

    if all_scryfall_ids:
        for sf_id in (cmd_sf_id, cmd2_sf_id):
            if sf_id and sf_id not in all_scryfall_ids:
                all_scryfall_ids.append(sf_id)
        threading.Thread(
            target=_fetch_and_save_images,
            args=(deck_id, all_scryfall_ids, cmd_name, cmd_sf_id, cmd2_name, cmd2_sf_id),
            daemon=True,
        ).start()

    return {"id": deck_id, "name": name, "results": results}

@app.put("/api/decks/{deck_id}")
def api_rename_deck(deck_id: int, req: RenameDeckRequest):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "Deck name is required")
    rename_deck(deck_id, name)
    return {"ok": True}

@app.delete("/api/decks/{deck_id}")
def api_delete_deck(deck_id: int):
    delete_deck(deck_id)
    return {"ok": True}

# ─── Deck Config Routes ───

@app.put("/api/decks/{deck_id}/color")
def api_update_deck_color(deck_id: int, req: UpdateColorRequest):
    if not req.color.strip():
        raise HTTPException(400, "Color is required")
    update_deck_color(deck_id, req.color.strip())
    return {"ok": True}

@app.put("/api/decks/{deck_id}/commander")
def api_update_deck_commander_route(deck_id: int, req: UpdateCommanderRequest):
    update_deck_commander(
        deck_id, req.commander_name or "", req.commander_image_url or "",
        req.commander2_name or "", req.commander2_image_url or "",
    )
    return {"ok": True}

@app.get("/api/decks/{deck_id}/color-identity")
def api_deck_color_identity(deck_id: int):
    identity = get_deck_color_identity(deck_id)
    return {"color_identity": identity}

@app.get("/api/decks/{deck_id}/stats")
def api_deck_stats(deck_id: int):
    return get_deck_cmc_distribution(deck_id)

# ─── Card Routes ───

@app.get("/api/decks/{deck_id}/cards")
def api_deck_cards(deck_id: int):
    return get_deck_cards(deck_id)

@app.post("/api/decks/{deck_id}/cards")
def api_add_cards(deck_id: int, req: AddCardsRequest):
    if not req.card_list.strip():
        raise HTTPException(400, "No cards provided")
    parsed = parse_card_list(req.card_list)
    if not parsed:
        raise HTTPException(400, "Could not parse any cards")
    results = []
    for quantity, card_name, set_code in parsed:
        resolved = validate_and_resolve_card(card_name, set_code)
        if resolved:
            add_card_to_deck(
                deck_id, card_name=resolved["name"], quantity=quantity,
                set_code=resolved["set_code"], scryfall_id=resolved["scryfall_id"],
                image_url=resolved["image_url"], mana_cost=resolved.get("mana_cost", ""),
                colors=resolved.get("colors", []), color_identity=resolved.get("color_identity", []),
                cmc=resolved.get("cmc", 0), type_line=resolved.get("type_line", ""),
            )
            results.append({"status": "ok", "requested": card_name, "resolved": resolved["name"], "quantity": quantity, "image_url": resolved["image_url"]})
        else:
            add_card_to_deck(deck_id, card_name=card_name, quantity=quantity, set_code=set_code or "")
            results.append({"status": "not_found", "requested": card_name, "quantity": quantity})
    return {"results": results}

@app.delete("/api/decks/{deck_id}/cards")
def api_clear_deck(deck_id: int):
    clear_deck_cards(deck_id)
    return {"ok": True}

@app.put("/api/cards/{card_id}")
def api_update_card(card_id: int, req: UpdateCardRequest):
    update_card(
        card_id, quantity=req.quantity, set_code=req.set_code, card_name=req.card_name,
        is_foil=req.is_foil, scryfall_id=req.scryfall_id, image_url=req.image_url,
    )
    return {"ok": True}

@app.delete("/api/cards/{card_id}")
def api_delete_card(card_id: int):
    delete_card(card_id)
    return {"ok": True}

@app.post("/api/cards/{card_id}/refresh")
def api_refresh_card(card_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM deck_cards WHERE id = ?", (card_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Card not found")
    card = dict(row)
    resolved = validate_and_resolve_card(card["card_name"], card.get("set_code"))
    if resolved:
        update_card(
            card_id, scryfall_id=resolved["scryfall_id"], image_url=resolved["image_url"],
            set_code=resolved["set_code"], mana_cost=resolved.get("mana_cost", ""),
            colors=resolved.get("colors", []), color_identity=resolved.get("color_identity", []),
            cmc=resolved.get("cmc", 0), type_line=resolved.get("type_line", ""),
        )
        return {"ok": True, "image_url": resolved["image_url"]}
    raise HTTPException(404, "Could not find card on Scryfall")

# ─── Collection ───

@app.get("/api/collection")
def api_collection():
    return get_collection()
@app.get("/api/cards/details")
def api_card_details(scryfall_id: str = "", card_name: str = ""):
    if not scryfall_id:
        if not card_name:
            raise HTTPException(400, "scryfall_id or card_name required")
        info = lookup_card(card_name)
        if not info:
            raise HTTPException(404, "Could not find card on Scryfall")
        scryfall_id = info["scryfall_id"]
    detail = fetch_card_detail(scryfall_id)
    if not detail:
        raise HTTPException(404, "Could not find card on Scryfall")
    return detail

# ─── Image Refresh ───

@app.post("/api/decks/{deck_id}/refresh-images")
def api_refresh_deck_images(deck_id: int):
    card_rows = get_deck_cards(deck_id)
    scryfall_to_db_id = {c["scryfall_id"]: c["id"] for c in card_rows if c.get("scryfall_id")}
    if scryfall_to_db_id:
        scryfall_ids = list(scryfall_to_db_id.keys())
        id_to_url = fetch_card_images_bulk(scryfall_ids)
        for scryfall_id, image_url in id_to_url.items():
            card_db_id = scryfall_to_db_id.get(scryfall_id)
            if card_db_id and image_url:
                update_card_image(card_db_id, image_url)
    deck = get_deck(deck_id)
    if deck:
        for slot, name_col in ((1, "commander_name"), (2, "commander2_name")):
            cmd_name = deck.get(name_col)
            if not cmd_name:
                continue
            cmd_rows = [c for c in card_rows if c["card_name"] == cmd_name and c.get("scryfall_id")]
            if not cmd_rows:
                continue
            cmd_images = fetch_card_images_bulk([cmd_rows[0]["scryfall_id"]])
            img = cmd_images.get(cmd_rows[0]["scryfall_id"])
            if img:
                update_deck_commander_image(deck_id, img, slot=slot)
    return {"ok": True}

@app.post("/api/refresh-images")
def api_refresh_all_images():
    threading.Thread(target=refresh_all_images, daemon=True).start()
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)