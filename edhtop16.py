"""edhtop16.com GraphQL client — competitive meta entries for a commander.

The browser cannot call edhtop16 cross-origin, so the backend proxies it.
Every parse is defensive: the upstream schema is not ours, so a missing key
must degrade to an empty value instead of a 500.
"""
import time
import requests

EDHTOP16_ENDPOINT = "https://edhtop16.com/api/graphql"
HEADERS = {"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"}

# Full maindecks are ~25 × 100 cards per commander query, so repeat comparisons
# are served from a short-lived cache keyed by entry id.
_MAINDECK_TTL = 15 * 60
_maindeck_cache: dict = {}


def _gql(query: str) -> dict:
    """POST a GraphQL query, return the `data` object. Raises RuntimeError."""
    try:
        res = requests.post(EDHTOP16_ENDPOINT, json={"query": query},
                            headers=HEADERS, timeout=20)
    except requests.RequestException as e:
        raise RuntimeError(f"edhtop16 request failed: {e}")

    if res.status_code != 200:
        raise RuntimeError(f"edhtop16 returned HTTP {res.status_code}")

    try:
        payload = res.json()
    except ValueError:
        raise RuntimeError("edhtop16 returned a non-JSON response")

    errors = payload.get("errors")
    if errors:
        msg = ""
        if isinstance(errors, list) and errors:
            first = errors[0]
            msg = first.get("message", "") if isinstance(first, dict) else str(first)
        raise RuntimeError(f"edhtop16 GraphQL error: {msg or 'unknown error'}")

    return payload.get("data") or {}


def commander_key(name1: str, name2: str = "") -> str:
    """edhtop16 indexes a partner pair under the single key "A / B"."""
    n1 = (name1 or "").strip()
    n2 = (name2 or "").strip()
    if n1 and n2:
        return f"{n1} / {n2}"
    return n1 or n2


def _escape(value: str) -> str:
    """Escape a Python string for embedding as a GraphQL string literal."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _entries_query(commander_key_str: str, first: int, with_maindeck: bool) -> str:
    maindeck = "maindeck { name manaCost imageUrls type }" if with_maindeck else ""
    return f"""
    query {{
      commander(name: "{_escape(commander_key_str)}") {{
        entries(first: {int(first)}, sortBy: TOP,
                filters: {{ minEventSize: 16, timePeriod: THREE_MONTHS }}) {{
          edges {{ node {{
            id standing wins winsBracket winsSwiss
            player {{ name }}
            tournament {{ name tournamentDate size }}
            {maindeck}
          }} }}
        }}
      }}
    }}
    """


def _edges(data: dict) -> list:
    commander = data.get("commander") or {}
    entries = commander.get("entries") or {}
    edges = entries.get("edges") or []
    return [e.get("node") or {} for e in edges if isinstance(e, dict)]


def _entry_summary(node: dict) -> dict:
    player = node.get("player") or {}
    tournament = node.get("tournament") or {}
    return {
        "id": node.get("id") or "",
        "standing": node.get("standing"),
        "wins": node.get("wins") or 0,
        "wins_bracket": node.get("winsBracket") or 0,
        "wins_swiss": node.get("winsSwiss") or 0,
        "player": player.get("name") or "",
        "tournament_name": tournament.get("name") or "",
        "tournament_date": tournament.get("tournamentDate") or "",
        "tournament_size": tournament.get("size") or 0,
    }


def get_commander_entries(commander_key_str: str, first: int = 25) -> list:
    """Top recent tournament entries for a commander (no decklists)."""
    if not (commander_key_str or "").strip():
        return []
    data = _gql(_entries_query(commander_key_str, first, with_maindeck=False))
    return [_entry_summary(n) for n in _edges(data) if n.get("id")]


def _maindeck_cards(node: dict) -> list:
    cards = []
    for card in node.get("maindeck") or []:
        if not isinstance(card, dict):
            continue
        images = card.get("imageUrls") or []
        cards.append({
            "name": card.get("name") or "",
            "mana_cost": card.get("manaCost") or "",
            "image_url": images[0] if images else "",
            "type": card.get("type") or "",
        })
    return cards


def get_entry_maindeck(commander_key_str: str, entry_id: str, first: int = 25) -> list:
    """Full 100-card maindeck for one entry. Cached for 15 minutes."""
    cached = _maindeck_cache.get(entry_id)
    now = time.time()
    if cached and now - cached[0] < _MAINDECK_TTL:
        return cached[1]

    if not (commander_key_str or "").strip() or not entry_id:
        return []

    data = _gql(_entries_query(commander_key_str, first, with_maindeck=True))
    found = []
    for node in _edges(data):
        cards = _maindeck_cards(node)
        node_id = node.get("id") or ""
        if node_id:
            _maindeck_cache[node_id] = (now, cards)
        if node_id == entry_id:
            found = cards
    return found
