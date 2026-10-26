import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageOff, Palette, RotateCcw, Search, ShoppingCart } from 'lucide-react';
import { api } from '../lib/api';
import type { Artwork, ArtworkPrinting, CardArtworks, CardFinish, CollectionCard } from '../lib/types';
import { Spinner } from './UI';

/**
 * Scryfall paces /cards/search at 2 req/s and the backend queues behind that,
 * so only a few visible rows ask at once; rows scrolled past before their turn
 * never fetch at all.
 */
const MAX_INFLIGHT = 3;

/** Results survive tab switches; the backend caches too, this just skips the round trip. */
const artworkCache = new Map<string, CardArtworks>();

const FINISH_LABEL: Record<CardFinish, string> = { nonfoil: 'Non-foil', foil: 'Foil', etched: 'Etched' };

/** One printing: its own frame/border, a foil-availability badge, and its finishes. */
function PrintingCard({ printing: p }: { printing: ArtworkPrinting }) {
  const owned = p.owned_finishes.length > 0;
  const foil = p.finishes.includes('foil') || p.finishes.includes('etched');
  return (
    <figure className={`art-print-card${owned ? ' is-owned' : ''}`} title={`${p.set_name} · ${p.released_at}`}>
      <span className="art-print-img">
        {p.image_url
          ? <img src={p.image_url} alt={`${p.set_name} printing`} loading="lazy" />
          : <span className="coll-art-empty"><ImageOff aria-hidden="true" /></span>}
        {p.owned_finishes.includes('foil') && <span className="foil-sheen" />}
        {owned && <span className="qty-badge">Owned</span>}
        {foil
          ? <span className="foil-badge corner">Foil</span>
          : <span className="foil-badge corner off">No foil</span>}
      </span>
      <figcaption className="art-print-body">
        <span className="art-print-id">
          <span className="art-print-set">{p.set_code.toUpperCase()}</span>
          <span className="art-print-num">#{p.collector_number}</span>
          <span className="art-print-year">{p.released_at.slice(0, 4)}</span>
        </span>
        <span className="art-finishes">
          {p.finishes.map(f => {
            // Etched copies are stored as foil (the app has one foil flag).
            const ownedFinish = p.owned_finishes.includes(f === 'nonfoil' ? 'nonfoil' : 'foil');
            return (
              <span key={f} className={`art-finish${ownedFinish ? ' is-owned' : ''}`}
                title={ownedFinish ? `${FINISH_LABEL[f]} — owned` : FINISH_LABEL[f]}>
                {FINISH_LABEL[f]}
              </span>
            );
          })}
        </span>
        {p.cardmarket_url && (
          <a className={`art-buy${p.cardmarket_exact ? '' : ' is-search'}`} href={p.cardmarket_url}
            target="_blank" rel="noopener noreferrer"
            title={p.cardmarket_exact
              ? `${p.set_name} #${p.collector_number} on Cardmarket`
              : `Cardmarket has no exact listing linked for this printing — search by name`}>
            {p.cardmarket_exact ? <ShoppingCart aria-hidden="true" /> : <Search aria-hidden="true" />}
            {p.cardmarket_exact ? 'Cardmarket' : 'Search CM'}
            <span className="art-buy-arrow" aria-hidden="true">↗</span>
          </a>
        )}
      </figcaption>
    </figure>
  );
}

/** One illustration: every printing (frame, border, treatment) that carries it, side by side. */
function ArtworkGroup({ art }: { art: Artwork }) {
  return (
    <section className={`art-group${art.owned ? ' is-owned' : ''}`} aria-label={`Art by ${art.artist}`}>
      <header className="art-group-head">
        <span className="art-artist" title={art.artist}>{art.artist || 'Unknown artist'}</span>
        <span className="art-group-count">
          {art.printings.length} printing{art.printings.length !== 1 ? 's' : ''}
        </span>
      </header>
      <div className="art-group-prints">
        {art.printings.map(p => <PrintingCard key={p.scryfall_id} printing={p} />)}
      </div>
    </section>
  );
}

function ArtworkRow({
  card, data, error, loading, onVisible, onRetry,
}: {
  card: CollectionCard;
  data?: CardArtworks;
  error?: string;
  loading: boolean;
  onVisible: (sid: string, visible: boolean) => void;
  onRetry: (sid: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const sid = card.scryfall_id;

  useEffect(() => {
    const el = ref.current;
    if (!el || !sid) return;
    const io = new IntersectionObserver(([e]) => onVisible(sid, e.isIntersecting), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => { io.disconnect(); onVisible(sid, false); };
  }, [sid, onVisible]);

  const printings = data?.artworks.reduce((n, a) => n + a.printings.length, 0) ?? 0;
  const foilArts = data?.artworks.filter(a => a.has_foil).length ?? 0;

  return (
    <section ref={ref} className="art-row" aria-label={card.card_name}>
      <header className="art-row-head">
        <span className="art-row-name">{card.card_name}</span>
        <span className="art-row-meta">
          ×{card.total_quantity}
          {data && <> · {data.artworks.length} artwork{data.artworks.length !== 1 ? 's' : ''}
            {' '}· {printings} printing{printings !== 1 ? 's' : ''} · {foilArts} with foil</>}
        </span>
      </header>
      {!sid ? (
        <p className="art-row-note">No Scryfall printing linked — refresh the card from its deck.</p>
      ) : error ? (
        <p className="art-row-note is-error">
          {error}
          <button type="button" className="btn-ghost" onClick={() => onRetry(sid)}>
            <RotateCcw size={12} aria-hidden="true" /> Retry
          </button>
        </p>
      ) : data ? (
        data.artworks.length === 0
          ? <p className="art-row-note">No paper printings on Scryfall.</p>
          : <div className="art-strip">{data.artworks.map(a => <ArtworkGroup key={a.illustration_id} art={a} />)}</div>
      ) : (
        <div className="art-strip is-pending">{loading ? <Spinner size={18} /> : null}</div>
      )}
    </section>
  );
}

export interface ArtworkTabProps {
  cards: CollectionCard[];
}

export function ArtworkTab({ cards }: ArtworkTabProps) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState<Record<string, CardArtworks>>(() => Object.fromEntries(artworkCache));
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [inflight, setInflight] = useState<ReadonlySet<string>>(new Set());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? cards.filter(c => c.card_name.toLowerCase().includes(q)) : cards;
  }, [cards, search]);

  // Stable: every row's observer effect depends on it.
  const onVisible = useMemo(() => (sid: string, isVisible: boolean) => setVisible(prev => {
    if (prev.has(sid) === isVisible) return prev;
    const next = new Set(prev);
    if (isVisible) next.add(sid); else next.delete(sid);
    return next;
  }), []);

  const onRetry = (sid: string) => setFailed(prev => { const n = { ...prev }; delete n[sid]; return n; });

  // Scheduler: fill free slots with visible, unfetched rows in list order.
  useEffect(() => {
    const free = MAX_INFLIGHT - inflight.size;
    if (free <= 0) return;
    const next = rows
      .map(c => c.scryfall_id)
      .filter(sid => sid && visible.has(sid) && !loaded[sid] && !failed[sid] && !inflight.has(sid))
      .slice(0, free);
    if (next.length === 0) return;
    setInflight(prev => new Set([...prev, ...next]));
    for (const sid of next) {
      api.getArtworks(sid)
        .then(d => { artworkCache.set(sid, d); setLoaded(p => ({ ...p, [sid]: d })); })
        .catch(e => setFailed(p => ({ ...p, [sid]: e instanceof Error ? e.message : String(e) })))
        .finally(() => setInflight(prev => { const n = new Set(prev); n.delete(sid); return n; }));
    }
  }, [rows, visible, loaded, failed, inflight]);

  return (
    <div className="page">
      <div className="section-head">
        <span className="sec-idx">03</span>
        <h2>Artwork</h2>
        <span className="head-action head-note">
          {rows.length} of {cards.length} cards · every official paper printing via Scryfall
        </span>
      </div>

      <input type="search" className="field search-field"
        placeholder={`Search ${cards.length.toLocaleString()} cards…`} aria-label="Search artwork"
        value={search} onChange={e => setSearch(e.target.value)} />

      {rows.length === 0 ? (
        <div className="empty-state">
          <span className="empty-emblem" aria-hidden="true"><Palette /></span>
          <h3 className="empty-title">{cards.length === 0 ? 'The binder is empty' : 'Nothing matches'}</h3>
          <p>{cards.length === 0
            ? 'Add a deck and every card in it shows up here with all of its artworks.'
            : 'No collection card matches that name.'}</p>
        </div>
      ) : (
        <div className="art-rows">
          {rows.map(c => (
            <ArtworkRow key={c.card_name} card={c}
              data={c.scryfall_id ? loaded[c.scryfall_id] : undefined}
              error={c.scryfall_id ? failed[c.scryfall_id] : undefined}
              loading={inflight.has(c.scryfall_id)}
              onVisible={onVisible} onRetry={onRetry} />
          ))}
        </div>
      )}
    </div>
  );
}
