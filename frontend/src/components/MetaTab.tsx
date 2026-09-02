import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowLeftRight, Check, Crown, Filter, Layers,
  MinusCircle, PlusCircle, Swords, Trophy, X,
} from 'lucide-react';
import { api } from '../lib/api';
import type {
  Deck, MetaCompareCard, MetaCompareResult, MetaDeckOverview, MetaEntry,
  MetaStockCard, MetaStockResult,
} from '../lib/types';
import { ManaCost } from './ManaPip';
import { CardImage, Spinner } from './UI';

/** `2026-06-13T14:30:00.000Z` → `13 Jun 2026`; unparseable dates pass through. */
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Swap any Scryfall image size for `large` so hover previews show the whole card. */
const previewUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/(art_crop|normal)\//, '/large/');
};

/** Hover a small thumb → enlarge the full card next to it (portal'd so scroll can't clip it). */
function CardZoom({ url, name, children }: { url: string; name: string; children: ReactNode }) {
  const [pop, setPop] = useState<{ left: number; top: number } | null>(null);
  const large = previewUrl(url);
  if (!large) return <>{children}</>;
  const POP_W = 230;
  return (
    <span
      className="card-zoom"
      onMouseEnter={e => {
        const r = e.currentTarget.getBoundingClientRect();
        const placeLeft = r.right + POP_W + 16 > window.innerWidth;
        setPop({ left: placeLeft ? r.left - POP_W - 8 : r.right + 8, top: r.top });
      }}
      onMouseLeave={() => setPop(null)}
    >
      {children}
      {pop && createPortal(
        <img
          className="card-zoom-pop"
          src={large}
          alt={name}
          style={{ left: pop.left, top: pop.top }}
        />,
        document.body,
      )}
    </span>
  );
}

function CardList({ cards, showQty }: { cards: MetaCompareCard[]; showQty: boolean }) {
  if (cards.length === 0) {
    return <p className="meta-list-empty">Nothing here.</p>;
  }
  return (
    <div className="meta-card-list">
      {cards.map(c => (
        <div key={c.name} className="card-row">
          <CardZoom url={c.image_url} name={c.name}>
            <CardImage url={c.image_url} name={c.name} size={34} style={{ borderRadius: 3 }} />
          </CardZoom>
          <span className="meta-card-name">{c.name}</span>
          <ManaCost cost={c.mana_cost} />
          {showQty && c.quantity > 1 ? <span className="meta-qty">×{c.quantity}</span> : null}
        </div>
      ))}
    </div>
  );
}

function CompareSection({
  title, Icon, cards, tone, showQty,
}: {
  title: string;
  Icon: typeof Swords;
  cards: MetaCompareCard[];
  tone: 'overlap' | 'missing' | 'mine';
  showQty: boolean;
}) {
  return (
    <section className={`meta-section meta-section-${tone}`}>
      <div className="section-head">
        <h3>
          <Icon size={14} aria-hidden="true" />
          {title}
        </h3>
        <span className="head-action meta-count">{cards.length}</span>
      </div>
      <CardList cards={cards} showQty={showQty} />
    </section>
  );
}

/** One aggregate stock card; click to reveal which meta players run it. */
function StockRow({ card, decksAnalyzed }: { card: MetaStockCard; decksAnalyzed: number }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(card.share * 100);
  // Backend ships every entry that runs the card; keep the reveal readable.
  const players = card.in_decks.slice(0, 12);
  const extraPlayers = card.in_decks.length - players.length;
  return (
    <div className="meta-stock-row">
      <button
        type="button"
        className="card-row meta-stock-btn"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <CardZoom url={card.image_url} name={card.name}>
          <CardImage url={card.image_url} name={card.name} size={34} style={{ borderRadius: 3 }} />
        </CardZoom>
        <span className="meta-stock-body">
          <span className="meta-card-name">{card.name}</span>
          {card.type ? <span className="meta-stock-type">{card.type}</span> : null}
        </span>
        <ManaCost cost={card.mana_cost} />
        <span
          className={`meta-count meta-stock-badge${card.count === decksAnalyzed ? ' is-unanimous' : ''}`}
          title={`${pct}% of analyzed decks`}
        >
          {card.count}/{decksAnalyzed}
        </span>
        {card.in_my_deck ? (
          <Check size={14} className="meta-stock-have" aria-label="In your deck" />
        ) : (
          <span className="meta-stock-have-gap" aria-hidden="true" />
        )}
      </button>
      {open ? (
        <p className="meta-stock-players">
          {players.length > 0
            ? players.join(' · ') + (extraPlayers > 0 ? ` · +${extraPlayers} more` : '')
            : 'No player data.'}
        </p>
      ) : null}
    </div>
  );
}

function StockView({ stock, deckName }: { stock: MetaStockResult; deckName: string }) {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const missing = stock.stock.filter(c => !c.in_my_deck);
  const rows = onlyMissing ? missing : stock.stock;

  if (stock.decks_analyzed === 0) {
    return (
      <div className="empty-state">
        <Trophy aria-hidden="true" />
        No meta decklists available for this commander yet.
      </div>
    );
  }

  return (
    <div className="meta-stock">
      <div className="meta-stock-head">
        <span className="meta-stock-summary">
          <Layers size={14} aria-hidden="true" />
          Analyzed {stock.decks_analyzed} top decks for{' '}
          <span className="meta-commander-name">{stock.commander}</span>
          {deckName ? ` · vs ${deckName}` : ''}
        </span>
        <span className="meta-count">
          {stock.missed_count} cards the meta plays that you don't
        </span>
      </div>

      <section className="meta-section meta-section-missing">
        <div className="section-head">
          <h3>
            <PlusCircle size={14} aria-hidden="true" />
            You're missing these
          </h3>
          <span className="head-action meta-count">{missing.length}</span>
        </div>
        {missing.length === 0 ? (
          <p className="meta-list-empty">Nothing — you run every stock card.</p>
        ) : (
          <div className="meta-card-list">
            {missing.map(c => (
              <StockRow key={c.name} card={c} decksAnalyzed={stock.decks_analyzed} />
            ))}
          </div>
        )}
      </section>

      <section className="meta-section">
        <div className="section-head">
          <h3>
            <Swords size={14} aria-hidden="true" />
            Full stock list
          </h3>
          <button
            type="button"
            className="chip head-action"
            aria-pressed={onlyMissing}
            onClick={() => setOnlyMissing(v => !v)}
          >
            <Filter size={12} aria-hidden="true" />
            Only show what I'm missing
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="meta-list-empty">Nothing here.</p>
        ) : (
          <div className="meta-card-list meta-stock-full">
            {rows.map(c => (
              <StockRow key={c.name} card={c} decksAnalyzed={stock.decks_analyzed} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export interface MetaTabProps {
  decks: Deck[];
  onError: (message: string) => void;
}

export function MetaTab({ decks, onError }: MetaTabProps) {
  const [deckId, setDeckId] = useState<number | null>(null);
  const [overview, setOverview] = useState<MetaDeckOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  const [compare, setCompare] = useState<MetaCompareResult | null>(null);
  const [compareEntryId, setCompareEntryId] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);

  const [view, setView] = useState<'entries' | 'stock'>('entries');
  const [topN, setTopN] = useState(10);
  const [stock, setStock] = useState<MetaStockResult | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState('');

  // Default to the first deck once decks arrive.
  useEffect(() => {
    if (deckId === null && decks.length > 0) setDeckId(decks[0].id);
  }, [decks, deckId]);

  const loadOverview = useCallback((id: number) => {
    setOverviewLoading(true);
    setOverviewError('');
    setOverview(null);
    api.getMetaForDeck(id)
      .then(setOverview)
      .catch(e => { setOverviewError(errText(e)); onError(errText(e)); })
      .finally(() => setOverviewLoading(false));
  }, [onError]);

  useEffect(() => {
    if (deckId === null) return;
    loadOverview(deckId);
  }, [deckId, loadOverview]);

  const openCompare = useCallback((entry: MetaEntry) => {
    if (deckId === null) return;
    setCompareEntryId(entry.id);
    setCompare(null);
    setCompareLoading(true);
    api.getMetaCompare(deckId, entry.id)
      .then(setCompare)
      .catch(e => { onError(errText(e)); setCompareEntryId(''); })
      .finally(() => setCompareLoading(false));
  }, [deckId, onError]);

  const loadStock = useCallback((id: number, n: number) => {
    setStockLoading(true);
    setStockError('');
    setStock(null);
    api.getMetaStock(id, n)
      .then(setStock)
      .catch(e => { setStockError(errText(e)); onError(errText(e)); })
      .finally(() => setStockLoading(false));
  }, [onError]);

  useEffect(() => {
    if (view !== 'stock' || deckId === null) return;
    loadStock(deckId, topN);
  }, [view, deckId, topN, loadStock]);

  const closeCompare = () => { setCompareEntryId(''); setCompare(null); };

  const selectedDeck = decks.find(d => d.id === deckId) || null;
  const entries = overview?.entries || [];

  return (
    <div className="page">
      <div className="section-head">
        <h2>Meta</h2>
        <span className="head-action" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          edhtop16 · top results, last 3 months, events 16+
        </span>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">
          <Swords aria-hidden="true" />
          No decks yet — import one first to compare it against the meta.
        </div>
      ) : (
        <>
          <div className="filter-row" style={{ marginBottom: 18 }}>
            <label className="filter-label" htmlFor="meta-deck-select">Deck</label>
            <select
              id="meta-deck-select"
              className="field"
              style={{ width: 'auto', minWidth: 240, flex: '0 1 auto' }}
              value={deckId ?? ''}
              onChange={e => { closeCompare(); setDeckId(Number(e.target.value)); }}
            >
              {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <label className="filter-label" htmlFor="meta-topn-select">Top decks</label>
            <select
              id="meta-topn-select"
              className="field"
              style={{ width: 'auto', flex: '0 1 auto' }}
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
            >
              {[5, 10, 15, 25].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {view === 'stock' ? (
              <button type="button" className="chip" onClick={() => setView('entries')}>
                <ArrowLeft size={12} aria-hidden="true" />
                Back to top decks
              </button>
            ) : (
              <button type="button" className="chip" onClick={() => { closeCompare(); setView('stock'); }}>
                <Layers size={12} aria-hidden="true" />
                Meta stock list
              </button>
            )}
          </div>

          {selectedDeck && overview && (
            <div className="meta-commander">
              <Crown size={14} aria-hidden="true" />
              <span className="meta-commander-name">{overview.commander || 'No commander set'}</span>
              <span className="meta-count">{entries.length} entries</span>
            </div>
          )}

          {view === 'stock' ? (
            stockLoading ? (
              <div className="empty-state"><Spinner size={22} /></div>
            ) : stockError ? (
              <div className="empty-state">
                <X aria-hidden="true" />
                {stockError}
              </div>
            ) : stock ? (
              <StockView stock={stock} deckName={selectedDeck?.name || ''} />
            ) : null
          ) : overviewLoading ? (
            <div className="empty-state"><Spinner size={22} /></div>
          ) : overviewError ? (
            <div className="empty-state">
              <X aria-hidden="true" />
              {overviewError}
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <Trophy aria-hidden="true" />
              No recent edhtop16 results for this commander.
            </div>
          ) : (
            <div className="meta-entry-list">
              {entries.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className="frame frame-hover meta-entry"
                  aria-pressed={compareEntryId === entry.id}
                  onClick={() => openCompare(entry)}
                >
                  <span className="meta-standing">#{entry.standing ?? '—'}</span>
                  <span className="meta-entry-body">
                    <span className="meta-player">{entry.player || 'Unknown player'}</span>
                    <span className="meta-tournament">
                      {entry.tournament_name}
                      {entry.tournament_size ? ` · ${entry.tournament_size} players` : ''}
                      {entry.tournament_date ? ` · ${fmtDate(entry.tournament_date)}` : ''}
                    </span>
                  </span>
                  <span className="meta-wins">{entry.wins}W</span>
                </button>
              ))}
            </div>
          )}

          {compareEntryId && (
            <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeCompare(); }}>
              <div className="modal-panel meta-compare-panel" style={{ maxWidth: 940 }} role="dialog" aria-modal="true" aria-label="Meta deck comparison">
                <div className="modal-head">
                  <div style={{ minWidth: 0 }}>
                    <h2 className="modal-title">
                      <ArrowLeftRight size={16} aria-hidden="true" />
                      {compare?.entry.player || 'Comparing…'}
                    </h2>
                    {compare && (
                      <div className="modal-sub">
                        #{compare.entry.standing ?? '—'} · {compare.entry.wins}W ·{' '}
                        {compare.entry.tournament_name}
                        {compare.entry.tournament_date ? ` · ${fmtDate(compare.entry.tournament_date)}` : ''}
                        {' · '}{compare.meta_maindeck_count} cards vs {selectedDeck?.name}
                      </div>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="icon-btn bare" onClick={closeCompare} aria-label="Close comparison">
                      <X />
                    </button>
                  </div>
                </div>

                {compareLoading || !compare ? (
                  <div className="empty-state"><Spinner size={22} /></div>
                ) : (
                  <div className="meta-compare">
                    <CompareSection
                      title="Meta plays, you don't"
                      Icon={PlusCircle}
                      cards={compare.missing_from_mine}
                      tone="missing"
                      showQty={false}
                    />
                    <CompareSection
                      title="You play, meta doesn't"
                      Icon={MinusCircle}
                      cards={compare.my_cards_not_in_meta}
                      tone="mine"
                      showQty
                    />
                    <CompareSection
                      title="In both"
                      Icon={Swords}
                      cards={compare.overlap}
                      tone="overlap"
                      showQty={false}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
