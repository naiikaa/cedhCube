"""Database models and helpers for the cEDHcube app."""
import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "collection.db")

# Predefined deck colors - assigned in order of deck creation
DECK_COLORS = [
    "#e94560",  # red-pink
    "#4ecdc4",  # teal
    "#ffe66d",  # yellow
    "#a8dadc",  # light blue
    "#f4a261",  # orange
    "#9b5de5",  # purple
    "#00bbf9",  # blue
    "#00f5d4",  # mint
    "#fee440",  # bright yellow
    "#f15bb5",  # pink
    "#8338ec",  # violet
    "#3a86ff",  # bright blue
    "#ff006e",  # magenta
    "#fb5607",  # deep orange
    "#80b918",  # lime
]


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS decks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#e94560',
            commander_name TEXT DEFAULT '',
            commander_image_url TEXT DEFAULT '',
            commander2_name TEXT DEFAULT '',
            commander2_image_url TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS deck_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deck_id INTEGER NOT NULL,
            card_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            set_code TEXT,
            scryfall_id TEXT,
            image_url TEXT,
            mana_cost TEXT DEFAULT '',
            colors TEXT DEFAULT '[]',
            color_identity TEXT DEFAULT '[]',
            cmc REAL DEFAULT 0,
            type_line TEXT DEFAULT '',
            is_foil INTEGER DEFAULT 0,
            price_eur REAL,
            price_eur_foil REAL,
            FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS price_history (
            scryfall_id TEXT NOT NULL,
            snapshot_ts TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            eur REAL,
            eur_foil REAL,
            PRIMARY KEY (scryfall_id, snapshot_ts)
        );

        CREATE INDEX IF NOT EXISTS idx_deck_cards_deck_id ON deck_cards(deck_id);
        CREATE INDEX IF NOT EXISTS idx_deck_cards_name ON deck_cards(card_name);
        CREATE INDEX IF NOT EXISTS idx_deck_cards_scryfall_id ON deck_cards(scryfall_id);
        CREATE INDEX IF NOT EXISTS idx_price_history_ts ON price_history(snapshot_ts);
    """)
    # Migrate existing DB: add columns if they don't exist
    cols = [row[1] for row in conn.execute("PRAGMA table_info(decks)").fetchall()]
    if 'commander_name' not in cols:
        conn.execute("ALTER TABLE decks ADD COLUMN commander_name TEXT DEFAULT ''")
    if 'commander_image_url' not in cols:
        conn.execute("ALTER TABLE decks ADD COLUMN commander_image_url TEXT DEFAULT ''")
    if 'commander2_name' not in cols:
        conn.execute("ALTER TABLE decks ADD COLUMN commander2_name TEXT DEFAULT ''")
    if 'commander2_image_url' not in cols:
        conn.execute("ALTER TABLE decks ADD COLUMN commander2_image_url TEXT DEFAULT ''")
    card_cols = [row[1] for row in conn.execute("PRAGMA table_info(deck_cards)").fetchall()]
    if 'is_foil' not in card_cols:
        conn.execute("ALTER TABLE deck_cards ADD COLUMN is_foil INTEGER DEFAULT 0")
    if 'price_eur' not in card_cols:
        conn.execute("ALTER TABLE deck_cards ADD COLUMN price_eur REAL")
    if 'price_eur_foil' not in card_cols:
        conn.execute("ALTER TABLE deck_cards ADD COLUMN price_eur_foil REAL")
    conn.commit()
    conn.close()


def get_deck_color():
    """Get the next available color for a new deck."""
    conn = get_db()
    try:
        count = conn.execute("SELECT COUNT(*) FROM decks").fetchone()[0]
        return DECK_COLORS[count % len(DECK_COLORS)]
    finally:
        conn.close()


# --- Deck operations ---

def add_deck(name, color=None):
    conn = get_db()
    try:
        if not color:
            color = get_deck_color()
        cursor = conn.execute("INSERT INTO decks (name, color) VALUES (?, ?)", (name, color))
        deck_id = cursor.lastrowid
        conn.commit()
        return deck_id
    finally:
        conn.close()


def get_decks():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT d.*, COUNT(dc.id) as card_count, COALESCE(SUM(dc.quantity), 0) as total_cards
            FROM decks d
            LEFT JOIN deck_cards dc ON dc.deck_id = d.id
            GROUP BY d.id
            ORDER BY d.created_at DESC
        """).fetchall()
        result = [dict(r) for r in rows]
        # Add color identity for each deck
        for deck in result:
            deck["color_identity"] = json.dumps(get_deck_color_identity(deck["id"]))
        return result
    finally:
        conn.close()


def get_deck(deck_id):
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM decks WHERE id = ?", (deck_id,)).fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def rename_deck(deck_id, new_name):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE decks SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_name, deck_id)
        )
        conn.commit()
    finally:
        conn.close()


def update_deck_color(deck_id, color):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE decks SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (color, deck_id)
        )
        conn.commit()
    finally:
        conn.close()


def update_deck_commander(deck_id, commander_name, commander_image_url,
                          commander2_name='', commander2_image_url=''):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE decks SET commander_name = ?, commander_image_url = ?, "
            "commander2_name = ?, commander2_image_url = ?, "
            "updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (commander_name or "", commander_image_url or "",
             commander2_name or "", commander2_image_url or "", deck_id)
        )
        conn.commit()
    finally:
        conn.close()


def delete_deck(deck_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM decks WHERE id = ?", (deck_id,))
        conn.commit()
    finally:
        conn.close()


def get_cards_missing_images():
    """Get cards that have a scryfall_id but no image_url.

    Returns a list of dicts with keys: id, scryfall_id, card_name
    """
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT id, scryfall_id, card_name
            FROM deck_cards
            WHERE scryfall_id IS NOT NULL AND scryfall_id != ''
              AND (image_url IS NULL OR image_url = '')
        """).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_card_image(card_id, image_url):
    """Update the image_url for a specific card."""
    conn = get_db()
    try:
        conn.execute(
            "UPDATE deck_cards SET image_url = ? WHERE id = ?",
            (image_url, card_id)
        )
        conn.commit()
    finally:
        conn.close()


def get_decks_missing_commander_images():
    """Get decks that have a commander name but no matching commander image.

    Covers both commander slots. Tries to find the commander card in deck_cards
    to get its scryfall_id.
    Returns list of dicts: deck_id, commander_name, scryfall_id, slot
    """
    query = """
        SELECT d.id as deck_id, d.{name_col} as commander_name, dc.scryfall_id
        FROM decks d
        JOIN deck_cards dc ON dc.deck_id = d.id AND dc.card_name = d.{name_col}
        WHERE d.{name_col} IS NOT NULL AND d.{name_col} != ''
          AND (d.{image_col} IS NULL OR d.{image_col} = '')
          AND dc.scryfall_id IS NOT NULL AND dc.scryfall_id != ''
        GROUP BY d.id
    """
    conn = get_db()
    try:
        result = []
        for slot, (name_col, image_col) in enumerate(
            (("commander_name", "commander_image_url"),
             ("commander2_name", "commander2_image_url")), start=1
        ):
            rows = conn.execute(query.format(name_col=name_col, image_col=image_col)).fetchall()
            for r in rows:
                entry = dict(r)
                entry["slot"] = slot
                result.append(entry)
        return result
    finally:
        conn.close()


def update_deck_commander_image(deck_id, image_url, slot=1):
    """Update the image URL for a deck's commander in `slot` (1 or 2)."""
    column = "commander2_image_url" if slot == 2 else "commander_image_url"
    conn = get_db()
    try:
        conn.execute(
            f"UPDATE decks SET {column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (image_url, deck_id)
        )
        conn.commit()
    finally:
        conn.close()


def get_deck_cmc_distribution(deck_id):
    """Get CMC distribution for a deck.

    Returns a dict with:
      - cmc_bars: list of {cmc, count} for cmc 0-5 and 6+ bucket
      - total_cards: total card count (sum of quantities)
      - avg_cmc: average CMC (weighted by quantity, lands excluded)
    """
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT cmc, SUM(quantity) as count
            FROM deck_cards
            WHERE deck_id = ?
            GROUP BY cmc
            ORDER BY cmc
        """, (deck_id,)).fetchall()

        # Build distribution: 0, 1, 2, 3, 4, 5, 6+
        cmc_map = {}
        for r in rows:
            cmc_map[r["cmc"]] = r["count"]

        cmc_bars = []
        total_cards = 0
        weighted_cmc_sum = 0
        for cmc in range(6):
            count = cmc_map.get(cmc, 0)
            cmc_bars.append({"cmc": cmc, "count": count})
            total_cards += count
            weighted_cmc_sum += cmc * count
        # 6+ bucket
        plus_count = sum(v for k, v in cmc_map.items() if k >= 6)
        cmc_bars.append({"cmc": 6, "count": plus_count, "label": "6+"})
        total_cards += plus_count
        weighted_cmc_sum += 6 * plus_count  # approximate for 6+

        avg_cmc = round(weighted_cmc_sum / total_cards, 2) if total_cards > 0 else 0

        return {
            "cmc_bars": cmc_bars,
            "total_cards": total_cards,
            "avg_cmc": avg_cmc,
        }
    finally:
        conn.close()


# --- Card operations ---

def add_card_to_deck(deck_id, card_name, quantity=1, set_code=None, scryfall_id=None,
                     image_url=None, mana_cost=None, colors=None, color_identity=None,
                     cmc=None, type_line=None, is_foil=0,
                     price_eur=None, price_eur_foil=None):
    conn = get_db()
    try:
        import json
        conn.execute("""
            INSERT INTO deck_cards (deck_id, card_name, quantity, set_code, scryfall_id,
                                    image_url, mana_cost, colors, color_identity, cmc, type_line,
                                    is_foil, price_eur, price_eur_foil)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (deck_id, card_name, quantity, set_code, scryfall_id, image_url,
              mana_cost or "",
              json.dumps(colors or []),
              json.dumps(color_identity or []),
              cmc or 0,
              type_line or "",
              is_foil or 0,
              price_eur, price_eur_foil))
        conn.commit()
    finally:
        conn.close()


def get_deck_cards(deck_id):
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT * FROM deck_cards WHERE deck_id = ? ORDER BY card_name
        """, (deck_id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_card(card_id, quantity=None, set_code=None, scryfall_id=None, image_url=None, card_name=None, is_foil=None, mana_cost=None, colors=None, color_identity=None, cmc=None, type_line=None):
    conn = get_db()
    try:
        import json
        fields = []
        values = []
        if quantity is not None:
            fields.append("quantity = ?")
            values.append(quantity)
        if set_code is not None:
            fields.append("set_code = ?")
            values.append(set_code)
        if scryfall_id is not None:
            fields.append("scryfall_id = ?")
            values.append(scryfall_id)
        if image_url is not None:
            fields.append("image_url = ?")
            values.append(image_url)
        if card_name is not None:
            fields.append("card_name = ?")
            values.append(card_name)
        if is_foil is not None:
            fields.append("is_foil = ?")
            values.append(is_foil)
        if mana_cost is not None:
            fields.append("mana_cost = ?")
            values.append(mana_cost)
        if colors is not None:
            fields.append("colors = ?")
            values.append(json.dumps(colors))
        if color_identity is not None:
            fields.append("color_identity = ?")
            values.append(json.dumps(color_identity))
        if cmc is not None:
            fields.append("cmc = ?")
            values.append(cmc)
        if type_line is not None:
            fields.append("type_line = ?")
            values.append(type_line)
        if fields:
            values.append(card_id)
            conn.execute(f"UPDATE deck_cards SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()
    finally:
        conn.close()


def delete_card(card_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM deck_cards WHERE id = ?", (card_id,))
        conn.commit()
    finally:
        conn.close()


def clear_deck_cards(deck_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM deck_cards WHERE deck_id = ?", (deck_id,))
        conn.commit()
    finally:
        conn.close()


def get_collection():
    """Get the full collection: all unique cards across all decks with total quantities and deck info."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT card_name, scryfall_id, image_url, set_code, type_line, mana_cost,
                   colors, color_identity, cmc,
                   SUM(quantity) as total_quantity,
                   COUNT(DISTINCT deck_id) as deck_count,
                   MAX(is_foil) as is_foil,
                   -- Representative unit prices for the grid. The grid shows a unit price only;
                   -- every total is computed per row elsewhere (see collection_value()), because
                   -- this grouping collapses foil and non-foil copies into one entry.
                   MAX(price_eur) as price_eur,
                   MAX(price_eur_foil) as price_eur_foil
            FROM deck_cards
            GROUP BY card_name
            ORDER BY card_name
        """).fetchall()
        result = [dict(r) for r in rows]

        # Add deck info for each card (which decks contain it, with colors)
        for card in result:
            deck_rows = conn.execute("""
                SELECT d.name, d.color
                FROM deck_cards dc
                JOIN decks d ON d.id = dc.deck_id
                WHERE dc.card_name = ?
                GROUP BY d.id
                ORDER BY d.name
            """, (card["card_name"],)).fetchall()
            card["decks"] = [{"name": r["name"], "color": r["color"]} for r in deck_rows]

        return result
    finally:
        conn.close()


def get_deck_color_identity(deck_id):
    """Calculate the combined color identity of all cards in a deck."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT color_identity FROM deck_cards WHERE deck_id = ?
        """, (deck_id,)).fetchall()
        import json
        all_colors = set()
        for row in rows:
            ci = json.loads(row["color_identity"]) if row["color_identity"] else []
            all_colors.update(ci)
        return sorted(all_colors)
    finally:
        conn.close()


# --- Price operations ---

# A row is worth `quantity ×` this: the price matching its foil flag, with the
# other finish as a fallback so a printing that only lists one of the two still
# counts. Rows with neither price contribute nothing (NULL is skipped by SUM).
_ROW_UNIT = """CASE WHEN dc.is_foil = 1
                    THEN COALESCE({foil}, {norm})
                    ELSE COALESCE({norm}, {foil}) END"""
_CURRENT_UNIT = _ROW_UNIT.format(foil="dc.price_eur_foil", norm="dc.price_eur")
_SNAPSHOT_UNIT = _ROW_UNIT.format(foil="px.eur_foil", norm="px.eur")

# Latest snapshot per (scryfall_id, day) — a mid-day manual refresh refines that
# day's point instead of adding a second one.
_DAILY_PRICES = """
    WITH daily AS (
        SELECT scryfall_id, date(snapshot_ts) AS day, MAX(snapshot_ts) AS ts
        FROM price_history
        WHERE date(snapshot_ts) >= ?
        GROUP BY scryfall_id, day
    ),
    px AS (
        SELECT d.day, d.scryfall_id, ph.eur, ph.eur_foil
        FROM daily d
        JOIN price_history ph
          ON ph.scryfall_id = d.scryfall_id AND ph.snapshot_ts = d.ts
    )
"""

WINDOW_DAYS = {"30D": 30, "90D": 90, "1Y": 365}


def window_cutoff(window):
    """Window label → inclusive `YYYY-MM-DD` lower bound ('ALL' → the epoch)."""
    days = WINDOW_DAYS.get((window or "").upper())
    if days is None:
        return "0001-01-01"
    conn = get_db()
    try:
        return conn.execute("SELECT date('now', ?)", (f"-{days} day",)).fetchone()[0]
    finally:
        conn.close()


def get_collection_scryfall_ids():
    """Every distinct Scryfall id owned, for the bulk price refresh."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT DISTINCT scryfall_id FROM deck_cards
            WHERE scryfall_id IS NOT NULL AND scryfall_id != ''
        """).fetchall()
        return [r["scryfall_id"] for r in rows]
    finally:
        conn.close()


def save_prices(prices, snapshot=True):
    """Write {scryfall_id: (eur, eur_foil)} onto the card rows and, by default,
    append today's history point. Ids absent from `prices` keep their cached
    values — a throttled or failed batch never blanks a known price.

    Returns the number of distinct printings written.
    """
    if not prices:
        return 0
    conn = get_db()
    try:
        for sid, (eur, eur_foil) in prices.items():
            conn.execute(
                "UPDATE deck_cards SET price_eur = ?, price_eur_foil = ? WHERE scryfall_id = ?",
                (eur, eur_foil, sid))
            if snapshot:
                conn.execute(
                    "DELETE FROM price_history WHERE scryfall_id = ? AND date(snapshot_ts) = date('now')",
                    (sid,))
                conn.execute("""
                    INSERT INTO price_history (scryfall_id, snapshot_ts, eur, eur_foil)
                    VALUES (?, datetime('now'), ?, ?)
                """, (sid, eur, eur_foil))
        conn.commit()
        return len(prices)
    finally:
        conn.close()


def get_last_snapshot():
    """ISO timestamp of the most recent price snapshot, or None."""
    conn = get_db()
    try:
        row = conn.execute("SELECT MAX(snapshot_ts) AS ts FROM price_history").fetchone()
        return row["ts"] if row and row["ts"] else None
    finally:
        conn.close()


def _deck_values_now(conn):
    rows = conn.execute(f"""
        SELECT dc.deck_id AS deck_id, SUM(dc.quantity * ({_CURRENT_UNIT})) AS value
        FROM deck_cards dc GROUP BY dc.deck_id
    """).fetchall()
    return {r["deck_id"]: r["value"] or 0.0 for r in rows}


def _deck_values_on(conn, day):
    """Current card rows valued at the prices recorded on `day`.

    Quantity history is not stored, so this answers "what would today's
    collection have been worth then", which is what the value chart plots.
    """
    rows = conn.execute(f"""
        {_DAILY_PRICES}
        SELECT dc.deck_id AS deck_id, SUM(dc.quantity * ({_SNAPSHOT_UNIT})) AS value
        FROM deck_cards dc
        JOIN px ON px.scryfall_id = dc.scryfall_id
        WHERE px.day = ?
        GROUP BY dc.deck_id
    """, (day, day)).fetchall()
    return {r["deck_id"]: r["value"] or 0.0 for r in rows}


def get_price_summary(delta_days=30):
    """Collection total, coverage, and per-deck value + N-day percentage delta."""
    conn = get_db()
    try:
        decks = conn.execute("SELECT id, name, color FROM decks ORDER BY created_at DESC").fetchall()
        now = _deck_values_now(conn)

        coverage = conn.execute(f"""
            SELECT COALESCE(SUM(CASE WHEN ({_CURRENT_UNIT}) IS NULL THEN 0 ELSE 1 END), 0) AS priced,
                   COALESCE(SUM(CASE WHEN ({_CURRENT_UNIT}) IS NULL THEN 1 ELSE 0 END), 0) AS unpriced
            FROM deck_cards dc
        """).fetchone()

        # Closest snapshot day at least `delta_days` old; without one there is
        # no honest delta to show.
        base_row = conn.execute("""
            SELECT MAX(date(snapshot_ts)) AS day FROM price_history
            WHERE date(snapshot_ts) <= date('now', ?)
        """, (f"-{delta_days} day",)).fetchone()
        base_day = base_row["day"] if base_row else None
        then = _deck_values_on(conn, base_day) if base_day else {}

        def delta(deck_id):
            before = then.get(deck_id)
            if not before:
                return None
            return round((now.get(deck_id, 0.0) - before) / before * 100, 2)

        deck_rows = [{
            "id": d["id"], "name": d["name"], "color": d["color"],
            "value": round(now.get(d["id"], 0.0), 2),
            "delta_30d": delta(d["id"]),
        } for d in decks]

        total = round(sum(now.values()), 2)
        total_then = sum(then.values()) if then else 0.0
        return {
            "currency": "EUR",
            "total": total,
            "delta_30d": round((total - total_then) / total_then * 100, 2) if total_then else None,
            "priced_rows": coverage["priced"],
            "unpriced_rows": coverage["unpriced"],
            "last_snapshot": get_last_snapshot(),
            "decks": deck_rows,
        }
    finally:
        conn.close()


def get_collection_history(window="90D"):
    """One point per snapshot day: collection total plus each deck's value."""
    cutoff = window_cutoff(window)
    conn = get_db()
    try:
        rows = conn.execute(f"""
            {_DAILY_PRICES}
            SELECT px.day AS day, dc.deck_id AS deck_id,
                   SUM(dc.quantity * ({_SNAPSHOT_UNIT})) AS value
            FROM deck_cards dc
            JOIN px ON px.scryfall_id = dc.scryfall_id
            GROUP BY px.day, dc.deck_id
            ORDER BY px.day
        """, (cutoff,)).fetchall()

        points = {}
        for r in rows:
            point = points.setdefault(r["day"], {"date": r["day"], "total": 0.0, "decks": {}})
            value = round(r["value"] or 0.0, 2)
            point["decks"][str(r["deck_id"])] = value
            point["total"] = round(point["total"] + value, 2)

        decks = conn.execute("SELECT id, name, color FROM decks ORDER BY created_at DESC").fetchall()
        return {
            "currency": "EUR",
            "window": (window or "90D").upper(),
            "points": [points[d] for d in sorted(points)],
            "decks": [{"id": d["id"], "name": d["name"], "color": d["color"]} for d in decks],
        }
    finally:
        conn.close()


def get_card_history(scryfall_id, window="90D"):
    """One point per snapshot day for a single printing."""
    cutoff = window_cutoff(window)
    conn = get_db()
    try:
        rows = conn.execute(f"""
            {_DAILY_PRICES}
            SELECT px.day AS day, px.eur AS eur, px.eur_foil AS eur_foil
            FROM px WHERE px.scryfall_id = ? ORDER BY px.day
        """, (cutoff, scryfall_id)).fetchall()
        return {
            "currency": "EUR",
            "window": (window or "90D").upper(),
            "scryfall_id": scryfall_id,
            "points": [{"date": r["day"], "eur": r["eur"], "eur_foil": r["eur_foil"]} for r in rows],
        }
    finally:
        conn.close()
