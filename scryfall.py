"""Scryfall API helpers for card validation and image lookup."""
import requests
import time
import re

SCRYFALL_SEARCH = "https://api.scryfall.com/cards/named"
SCRYFALL_CARD = "https://api.scryfall.com/cards/"
SCRYFALL_CARD_SEARCH = "https://api.scryfall.com/cards/search"
SCRYFALL_COLLECTION = "https://api.scryfall.com/cards/collection"
# Scryfall asks every client for both headers; without Accept it may answer
# with a non-JSON representation.
HEADERS = {
    "User-Agent": "cEDHcube/1.0 (personal project)",
    "Accept": "application/json",
}

# /cards/collection is capped around 2 requests/second. Interactive one-card
# lookups keep a courtesy delay; the collection-wide price snapshot walks
# hundreds of cards and sleeps a full beat between batches.
INTERACTIVE_DELAY = 0.1
BULK_DELAY = 0.5
RATE_LIMIT_BACKOFF = 30


def lookup_card(name, set_code=None):
    """Look up a card by name (and optionally set code). Returns dict with card info or None."""
    params = {"fuzzy": name}
    if set_code:
        params["set"] = set_code.lower()

    try:
        resp = requests.get(SCRYFALL_SEARCH, params=params, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "scryfall_id": data["id"],
                "name": data["name"],
                "set_code": data.get("set", ""),
                "image_url": get_image_url(data),
                "mana_cost": data.get("mana_cost", ""),
                "type_line": data.get("type_line", ""),
                "colors": data.get("colors", []),
                "color_identity": data.get("color_identity", []),
                "cmc": data.get("converted_mana_cost", 0),
                "oracle_text": get_oracle_text(data),
                **get_prices(data),
            }
        elif resp.status_code == 404:
            return None
        else:
            return None
    except Exception:
        return None


def get_image_url(data):
    """Extract the best available image URL from a Scryfall card object."""
    # Prefer card_faces for split/double-faced cards
    if "card_faces" in data:
        face = data["card_faces"][0]
        if "image_uris" in face:
            return face["image_uris"].get("normal", face["image_uris"].get("small", ""))
    if "image_uris" in data:
        return data["image_uris"].get("normal", data["image_uris"].get("small", ""))
    return ""


def _eur(value):
    """Scryfall prices arrive as decimal strings or null. "0.00" is a price."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_prices(data):
    """EUR paper prices of a Scryfall card object.

    Both finishes are returned raw regardless of what the owner holds; the
    stored `is_foil` flag decides which one is displayed and summed.
    """
    prices = data.get("prices") or {}
    return {"price_eur": _eur(prices.get("eur")), "price_eur_foil": _eur(prices.get("eur_foil"))}


def get_oracle_text(data):
    """Concatenate the oracle text of a Scryfall card object across all faces."""
    faces = data.get("card_faces")
    if faces:
        return "\n".join(f.get("oracle_text", "") for f in faces if f.get("oracle_text"))
    return data.get("oracle_text", "") or ""


def parse_card_list(text):
    """Parse a pasted card list into (quantity, card_name, set_code) tuples.

    Supports common formats:
        4 Lightning Bolt
        3x Counterspell
        2 Lightning Bolt (M11)
        1 Black Lotus [LEA]
    """
    cards = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue

        quantity = 1
        card_name = line
        set_code = None

        # Try: "4 Lightning Bolt (SET)" or "4 Lightning Bolt [SET]"
        m = re.match(r'^(\d+)\s+(.+?)\s*[\(\[]([a-zA-Z0-9]{3,6})[\)\]]$', line)
        if m:
            quantity = int(m.group(1))
            card_name = m.group(2).strip()
            set_code = m.group(3).strip()
        else:
            # Try: "4x Lightning Bolt"
            m = re.match(r'^(\d+)x\s+(.+)$', line)
            if m:
                quantity = int(m.group(1))
                card_name = m.group(2).strip()
            else:
                # Try: "4 Lightning Bolt" (just a number at start)
                m = re.match(r'^(\d+)\s+(.+)$', line)
                if m:
                    quantity = int(m.group(1))
                    card_name = m.group(2).strip()

        cards.append((quantity, card_name, set_code))
    return cards


def validate_and_resolve_card(name, set_code=None):
    """Look up a card. Returns resolved card info dict or None if not found."""
    # Be nice to the API - small delay
    time.sleep(INTERACTIVE_DELAY)
    return lookup_card(name, set_code)


def fetch_cards_bulk(scryfall_ids, delay=BULK_DELAY, on_batch_error=None):
    """Fetch card data for many printings through /cards/collection.

    The single seam for bulk card data: returns
    {scryfall_id: {"image_url", "price_eur", "price_eur_foil"}} in batches of 75
    (Scryfall's limit). A batch that 429s is retried once after a backoff; a
    batch that still fails is skipped, so callers never see a card mapped to
    empty data and can leave whatever they cached in place.
    """
    result = {}
    ids = list({sid for sid in scryfall_ids if sid})

    for i in range(0, len(ids), 75):
        batch = ids[i:i + 75]
        payload = {"identifiers": [{"id": sid} for sid in batch]}
        for attempt in (0, 1):
            try:
                resp = requests.post(SCRYFALL_COLLECTION, json=payload, headers=HEADERS, timeout=30)
                if resp.status_code == 429 and attempt == 0:
                    time.sleep(RATE_LIMIT_BACKOFF)
                    continue
                if resp.status_code != 200:
                    if on_batch_error:
                        on_batch_error(resp.status_code)
                    break
                for card in resp.json().get("data", []):
                    result[card["id"]] = {"image_url": get_image_url(card), **get_prices(card)}
            except Exception:
                if on_batch_error:
                    on_batch_error(None)
            break
        if i + 75 < len(ids):
            time.sleep(delay)

    return result


def fetch_card_images_bulk(scryfall_ids):
    """{scryfall_id: image_url} for cards that have one — a projection of
    fetch_cards_bulk kept for the image-refresh paths."""
    return {sid: card["image_url"]
            for sid, card in fetch_cards_bulk(scryfall_ids, delay=INTERACTIVE_DELAY).items()
            if card["image_url"]}


def fetch_card_detail(scryfall_id):
    """Fetch localized names, full oracle text, rulings and prices for a card.

    Returns dict {name_en, name_de, name_ja, oracle_text, rulings,
    price_eur, price_eur_foil} or None.
    """
    try:
        resp = requests.get(SCRYFALL_CARD + scryfall_id, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        card = resp.json()
    except Exception:
        return None

    oracle_id = card.get("oracle_id", "")

    def _localized_name(locale):
        """Localized name via oracle_id search: read printed_name (fallback name).

        /cards/named does NOT accept a q= search query (it is keyed on the
        English name), so localization must go through /cards/search with the
        oracleid: + lang: operators.
        """
        if not oracle_id:
            return ""
        try:
            r = requests.get(
                SCRYFALL_CARD_SEARCH,
                params={"q": f"oracleid:{oracle_id} lang:{locale}"},
                headers=HEADERS,
                timeout=10,
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("data"):
                    loc = data["data"][0]
                    # In the default 'unique=cards' search response the `name`
                    # field is the English oracle name; the localized label for
                    # the target language is carried by `printed_name`, so
                    # prefer that and fall back to `name`.
                    return (loc.get("printed_name") or loc.get("name") or "").strip()
        except Exception:
            pass
        return ""

    name_en = card.get("name", "")
    name_de = _localized_name("de") or name_en
    name_ja = _localized_name("ja") or name_en

    faces = card.get("card_faces") or []
    if faces:
        oracle_text = "\n\n".join(f.get("oracle_text", "").strip() for f in faces if f.get("oracle_text"))
    else:
        oracle_text = card.get("oracle_text", "").strip()

    rulings = []
    try:
        r = requests.get(SCRYFALL_CARD + scryfall_id + "/rulings", headers=HEADERS, timeout=10)
        if r.status_code == 200:
            for rule in r.json().get("data", [])[:5]:
                if rule.get("comment"):
                    rulings.append({"comment": rule["comment"], "published_at": rule.get("published_at", "")})
    except Exception:
        pass

    return {
        "name_en": name_en,
        "name_de": name_de,
        "name_ja": name_ja,
        "oracle_text": oracle_text,
        "rulings": rulings,
        **get_prices(card),
    }
