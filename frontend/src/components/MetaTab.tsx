import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Crown, MinusCircle, PlusCircle, Swords, Trophy, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Deck, MetaCompareCard, MetaCompareResult, MetaDeckOverview, MetaEntry } from '../lib/types';
import { ManaCost } from './ManaPip';
import { CardImage, Spinner } from './UI';

/** `2026-06-13T14:30:00.000Z` → `13 Jun 2026`; unparseable dates pass through. */
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function CardList({ cards, showQty }: { cards: MetaCompareCard[]; showQty: boolean }) {
  if (cards.length === 0) {
    return <p className="meta-list-empty">Nothing here.</p>;
  }
  return (
    <div className="meta-card-list">
      {cards.map(c => (
        <div key={c.name} className="card-row">
          <CardImage url={c.image_url} name={c.name} size={34} style={{ borderRadius: 3 }} />
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
          </div>

          {selectedDeck && overview && (
            <div className="meta-commander">
              <Crown size={14} aria-hidden="true" />
              <span className="meta-commander-name">{overview.commander || 'No commander set'}</span>
              <span className="meta-count">{entries.length} entries</span>
            </div>
          )}

          {overviewLoading ? (
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
              <div className="modal-panel" style={{ maxWidth: 780 }} role="dialog" aria-modal="true" aria-label="Meta deck comparison">
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
