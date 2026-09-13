"""Paper-price snapshots.

Prices ride the fetch paths the app already walks (see scryfall.fetch_cards_bulk);
this module only decides *when* to walk them collection-wide and what to persist.
A daemon thread — same idiom as the background image refresh — runs the snapshot
once a day at ~04:00, plus a catch-up run at startup when today has no snapshot.
"""
import threading
import time
from datetime import datetime, timedelta

from database import get_collection_scryfall_ids, get_last_snapshot, save_prices
from scryfall import BULK_DELAY, fetch_cards_bulk

# Local wall-clock hour for the daily snapshot.
SNAPSHOT_HOUR = 4
# Grace period after boot before the catch-up run, so imports and image
# refreshes get the network first.
STARTUP_DELAY = 20

_lock = threading.Lock()


def refresh_prices():
    """Price every owned printing and append today's history point.

    Returns {"cards": n, "skipped": m}. Ids Scryfall did not answer for keep
    their cached prices — a throttled batch must never blank a known value.
    """
    if not _lock.acquire(blocking=False):
        return {"cards": 0, "skipped": 0, "busy": True}
    try:
        ids = get_collection_scryfall_ids()
        if not ids:
            return {"cards": 0, "skipped": 0}
        cards = fetch_cards_bulk(ids, delay=BULK_DELAY)
        prices = {sid: (c["price_eur"], c["price_eur_foil"]) for sid, c in cards.items()}
        save_prices(prices)
        return {"cards": len(prices), "skipped": len(ids) - len(prices)}
    finally:
        _lock.release()


def refresh_prices_async():
    """Run a snapshot on a background thread; returns immediately."""
    threading.Thread(target=refresh_prices, daemon=True).start()


def _seconds_until_next_run(now=None):
    now = now or datetime.now()
    nxt = now.replace(hour=SNAPSHOT_HOUR, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


def _snapshot_is_stale():
    last = get_last_snapshot()
    return not last or last[:10] < datetime.now().strftime("%Y-%m-%d")


def _daemon():
    time.sleep(STARTUP_DELAY)
    if _snapshot_is_stale():
        refresh_prices()
    while True:
        time.sleep(_seconds_until_next_run())
        refresh_prices()


def start_price_daemon():
    threading.Thread(target=_daemon, daemon=True).start()
