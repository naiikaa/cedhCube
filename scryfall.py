"""Scryfall API helpers for card validation and image lookup."""
import requests
import time
import re

SCRYFALL_SEARCH = "https://api.scryfall.com/cards/named"
SCRYFALL_CARD = "https://api.scryfall.com/cards/"
HEADERS = {"User-Agent": "cEDHcube/1.0 (personal project)"}
SCRYFALL_CARD_SEARCH = "https://api.scryfall.com/cards/search"


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
    time.sleep(0.1)
    return lookup_card(name, set_code)
def fetch_card_detail(scryfall_id):
    """Fetch localized names, full oracle text, and rulings for a card.

    Returns dict {name_en, name_de, name_ja, oracle_text, rulings} or None.
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
    }
