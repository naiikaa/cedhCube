import { useCallback, useEffect, useState } from 'react';
import { Armchair, Check, Dices, Hand, Lock, RotateCcw, Swords, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Deck, MulliganCard, MulliganDeal } from '../lib/types';
import { ManaCost } from './ManaPip';
import { CardImage, CardZoom, cropUrl, Spinner } from './UI';

/** Width of a hand card; `CardImage` derives the height from the art's own ratio. */
const HAND_CARD_W = 150;
const KEPT_CARD_W = 132;
const SHIPPED_CARD_W = 104;

/** A hand card, optionally clickable. Shipped cards keep their art but read as discarded. */
function HandCard({
  card, width, shipped, onToggle,
}: {
  card: MulliganCard;
  width: number;
  shipped: boolean;
  onToggle?: () => void;
}) {
  const art = (
    <>
      <CardZoom url={card.image_url} name={card.name}>
        <CardImage url={cropUrl(card.image_url)} name={card.name} size={width} style={{ borderRadius: 5 }} />
      </CardZoom>
      <span className="mulligan-card-meta">
        <span className="mulligan-card-name">{card.name}</span>
        <ManaCost cost={card.mana_cost} />
      </span>
      {shipped && (
        <span className="mulligan-ship-badge" aria-hidden="true">
          <X size={12} />
        </span>
      )}
    </>
  );

  const cls = `mulligan-card${shipped ? ' mulligan-card-shipped' : ''}`;
  if (!onToggle) {
    return <div className={cls} style={{ width }}>{art}</div>;
  }
  return (
    <button
      type="button"
      className={cls}
      style={{ width }}
      aria-pressed={shipped}
      title={shipped ? 'Keep this card' : 'Ship this card'}
      onClick={onToggle}
    >
      {art}
    </button>
  );
}

export interface MulliganTabProps {
  decks: Deck[];
  onError: (message: string) => void;
}

export function MulliganTab({ decks, onError }: MulliganTabProps) {
  const [deckId, setDeckId] = useState<number | null>(null);
  const [deal, setDeal] = useState<MulliganDeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [dealError, setDealError] = useState('');
  // Hand indices marked for the bin. Indices, not names: a 4-of can appear twice.
  const [shipped, setShipped] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);

  // Default to the first deck once decks arrive.
  useEffect(() => {
    if (deckId === null && decks.length > 0) setDeckId(decks[0].id);
  }, [decks, deckId]);

  const dealHand = useCallback((id: number) => {
    setLoading(true);
    setDealError('');
    setShipped([]);
    setLocked(false);
    api.dealMulligan(id)
      .then(setDeal)
      .catch(e => {
        const msg = e instanceof Error ? e.message : String(e);
        setDeal(null);
        setDealError(msg);
        onError(msg);
      })
      .finally(() => setLoading(false));
  }, [onError]);

  const selectDeck = (id: number) => {
    setDeckId(id);
    setDeal(null);
    setShipped([]);
    setLocked(false);
    setDealError('');
  };

  const toggleShipped = (i: number) => {
    if (locked) return;
    setShipped(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]));
  };

  const hand = deal?.hand || [];
  const shipCount = deal?.ship_count ?? 0;
  const canLock = deal !== null && !locked && shipped.length === shipCount;
  const kept = hand.filter((_, i) => !shipped.includes(i));
  const binned = hand.filter((_, i) => shipped.includes(i));

  return (
    <div className="page">
      <div className="section-head">
        <h2>Mulligans</h2>
        <span className="head-action" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          one round · random ship quota · pod from edhtop16's top list
        </span>
      </div>

      {decks.length === 0 ? (
        <div className="empty-state">
          <Dices aria-hidden="true" />
          No decks yet — import one first to practise mulligans with it.
        </div>
      ) : (
        <>
          <div className="filter-row mulligan-actions" style={{ marginBottom: 18 }}>
            <label className="filter-label" htmlFor="mulligan-deck-select">Deck</label>
            <select
              id="mulligan-deck-select"
              className="field"
              style={{ width: 'auto', minWidth: 240, flex: '0 1 auto' }}
              value={deckId ?? ''}
              onChange={e => selectDeck(Number(e.target.value))}
            >
              {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button
              type="button"
              className="chip"
              disabled={deckId === null || loading}
              onClick={() => { if (deckId !== null) dealHand(deckId); }}
            >
              {loading ? <Spinner size={12} inline /> : <Dices size={12} aria-hidden="true" />}
              {deal ? 'New round' : 'Deal hand'}
            </button>
            {deal && !locked && (
              <button type="button" className="chip" disabled={!canLock} onClick={() => setLocked(true)}>
                <Lock size={12} aria-hidden="true" />
                Lock hand
              </button>
            )}
            {locked && (
              <button
                type="button"
                className="chip"
                onClick={() => { setShipped([]); setLocked(false); }}
              >
                <RotateCcw size={12} aria-hidden="true" />
                Unlock
              </button>
            )}
          </div>

          {loading ? (
            <div className="empty-state"><Spinner size={22} /></div>
          ) : dealError ? (
            <div className="empty-state">
              <X aria-hidden="true" />
              {dealError}
            </div>
          ) : !deal ? (
            <div className="empty-state">
              <Hand aria-hidden="true" />
              Deal a hand to start a round.
            </div>
          ) : (
            <>
              <div className="meta-commander mulligan-round">
                <Armchair size={14} aria-hidden="true" />
                <span className="meta-commander-name">{deal.deck_name}</span>
                <span className="meta-count">Seat {deal.seat} of 4</span>
                <span className={`mulligan-quota${shipCount === 0 ? ' is-free' : ''}`}>
                  {shipCount === 0
                    ? 'No cards to ship — keep all 7'
                    : `Ship ${shipCount} card${shipCount === 1 ? '' : 's'}`}
                </span>
                {!locked && (
                  <span className={`meta-count${canLock ? ' mulligan-ready' : ''}`}>
                    Shipped: {shipped.length} / {shipCount}
                  </span>
                )}
                {locked && (
                  <span className="meta-count mulligan-ready">
                    <Check size={11} aria-hidden="true" /> Locked · kept {kept.length}
                  </span>
                )}
              </div>

              <section className="mulligan-pod">
                <div className="section-head">
                  <h3><Users size={14} aria-hidden="true" />Your pod</h3>
                  <span className="head-action meta-count">{deal.enemies.length} opponents</span>
                </div>
                {deal.enemies.length === 0 ? (
                  <p className="meta-list-empty">No meta opponents available right now.</p>
                ) : (
                  <div className="mulligan-enemy-row">
                    {deal.enemies.map(enemy => (
                      <div key={enemy.name} className="mulligan-enemy">
                        <CardZoom url={enemy.image_url} name={enemy.name}>
                          <CardImage
                            url={cropUrl(enemy.image_url)}
                            name={enemy.name}
                            size={56}
                            style={{ borderRadius: 4 }}
                          />
                        </CardZoom>
                        <span className="mulligan-enemy-name">{enemy.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {locked ? (
                <>
                  <section className="mulligan-kept">
                    <div className="section-head">
                      <h3><Hand size={14} aria-hidden="true" />Kept hand</h3>
                      <span className="head-action meta-count">{kept.length} cards</span>
                    </div>
                    <div className="mulligan-hand-grid">
                      {kept.map((card, i) => (
                        <HandCard key={`${card.name}-${i}`} card={card} width={KEPT_CARD_W} shipped={false} />
                      ))}
                    </div>
                  </section>

                  {binned.length > 0 && (
                    <section className="mulligan-bin">
                      <div className="section-head">
                        <h3><X size={14} aria-hidden="true" />Shipped</h3>
                        <span className="head-action meta-count">{binned.length} cards</span>
                      </div>
                      <div className="mulligan-hand-grid mulligan-hand-grid-small">
                        {binned.map((card, i) => (
                          <HandCard key={`${card.name}-${i}`} card={card} width={SHIPPED_CARD_W} shipped />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <section className="mulligan-hand">
                  <div className="section-head">
                    <h3><Swords size={14} aria-hidden="true" />Opening hand</h3>
                    <span className="head-action meta-count">
                      {shipCount === 0 ? 'Lock to keep all 7' : 'Click cards to ship them'}
                    </span>
                  </div>
                  <div className="mulligan-hand-grid">
                    {hand.map((card, i) => (
                      <HandCard
                        key={`${card.name}-${i}`}
                        card={card}
                        width={HAND_CARD_W}
                        shipped={shipped.includes(i)}
                        onToggle={() => toggleShipped(i)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
