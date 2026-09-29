import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import {
  Check, CircleCheck, CircleX, ClipboardList, Crown, ImageOff, Link, LibraryBig, Pencil, Plus,
  RefreshCw, Trash2, X,
} from 'lucide-react';
import { api } from './lib/api';
import type {
  Deck, Card, CollectionCard, CardResult, CmcStats, CardDetail, PriceSummary,
} from './lib/types';
import { ColorIdentity } from './components/ColorIdentity';
import { ManaCost, OracleText } from './components/ManaPip';
import { FullManaCurve, MiniManaCurve } from './components/ManaCurve';
import { Header } from './components/Header';
import { CardImage, Spinner } from './components/UI';
import { CommanderFrame } from './components/CommanderFrame';
import { deckCommanders, type CommanderPick } from './lib/deck';
import { useToast, Toast } from './components/Toast';
import { MetaTab } from './components/MetaTab';
import { MulliganTab } from './components/MulliganTab';
import { CardPrice, PriceBox, PriceDelta, fmtEur } from './components/Price';
import { CardSparkline, ValueHistoryPanel } from './components/PriceChart';

const TABS = [
  { value: 'decks', label: 'Decks' },
  { value: 'collection', label: 'Collection' },
  { value: 'meta', label: 'Meta' },
  { value: 'mulligans', label: 'Mulligans' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/** Collection type filters, each paired with its authentic MTG card-type glyph. */
const TYPE_FILTERS: { value: string; label: string; glyph?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'creature', label: 'Creature', glyph: 'creature' },
  { value: 'instant', label: 'Instant', glyph: 'instant' },
  { value: 'sorcery', label: 'Sorcery', glyph: 'sorcery' },
  { value: 'enchantment', label: 'Enchantment', glyph: 'enchantment' },
  { value: 'artifact', label: 'Artifact', glyph: 'artifact' },
  { value: 'planeswalker', label: 'Planeswalker', glyph: 'planeswalker' },
  { value: 'land', label: 'Land', glyph: 'land' },
];

const DEFAULT_DECK_COLOR = '#e94560';

/** Single place that turns a rejected API promise into toast copy. */
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ─── App ───
export default function App() {
  const [tab, setTab] = useState<TabValue>('decks');
  const { show, toasts, remove } = useToast();
  // Stable identity: MetaTab keys its fetch effect off this callback.
  const showError = useCallback((msg: string) => show(msg, 'error'), [show]);

  // ── Decks ──
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [deckStats, setDeckStats] = useState<Record<number, CmcStats>>({});
  const [refreshingImages, setRefreshingImages] = useState(false);

  // ── Modal ──
  const [modalDeck, setModalDeck] = useState<Deck | null>(null);
  const [modalCards, setModalCards] = useState<Card[]>([]);
  const [modalStats, setModalStats] = useState<CmcStats | null>(null);
  const [modalCI, setModalCI] = useState<string[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [addCardsText, setAddCardsText] = useState('');
  const [addCardsLoading, setAddCardsLoading] = useState(false);
  const [addCardsResults, setAddCardsResults] = useState<CardResult[]>([]);
  const [showCommanderPicker, setShowCommanderPicker] = useState(false);

  // ── Collection ──
  const [allCollection, setAllCollection] = useState<CollectionCard[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledDeckIds, setEnabledDeckIds] = useState<Record<number, boolean>>({});

  // ── Prices ──
  const [priceSummary, setPriceSummary] = useState<PriceSummary | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  // ── Card detail modal ──
  const [detailCard, setDetailCard] = useState<CollectionCard | null>(null);
  const [cardDetail, setCardDetail] = useState<CardDetail | null>(null);
  const [cardDetailLoading, setCardDetailLoading] = useState(false);

  // ── Forms ──
  const [deckName, setDeckName] = useState('');
  const [deckCards, setDeckCards] = useState('');
  const [deckColor, setDeckColor] = useState(DEFAULT_DECK_COLOR);
  const [creating, setCreating] = useState(false);
  const [moxUrl, setMoxUrl] = useState('');
  const [moxColor, setMoxColor] = useState(DEFAULT_DECK_COLOR);
  const [importing, setImporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'paste' | 'moxfield'>('paste');
  const openAdd = () => { setAddMode('paste'); setAddOpen(true); };

  // ── Load ──
  const loadDecks = useCallback(() => {
    setDecksLoading(true);
    api.getDecks().then(d => {
      setDecks(d);
      setDecksLoading(false);
      d.forEach(dd => api.getDeckStats(dd.id).then(s => setDeckStats(p => ({ ...p, [dd.id]: s }))).catch(() => {}));
    }).catch(e => { show(errText(e), 'error'); setDecksLoading(false); });
  }, [show]);

  const loadCollection = useCallback(() => {
    api.getCollection().then(setAllCollection).catch(e => show(errText(e), 'error'));
  }, [show]);

  // Prices are cached on the card rows, so this is one cheap query — never a
  // Scryfall round trip.
  const loadPrices = useCallback(() => {
    api.getPriceSummary().then(setPriceSummary).catch(e => show(errText(e), 'error'));
  }, [show]);

  /** Pulls fresh prices from Scryfall in the background, then re-reads them. */
  const refreshPrices = async () => {
    setRefreshingPrices(true);
    show('Refreshing prices…', 'info');
    try {
      await api.refreshPrices();
      // The snapshot walks the collection in batches; give it a beat, then
      // re-read whatever has landed.
      setTimeout(() => { loadPrices(); loadCollection(); setRefreshingPrices(false); }, 8000);
    } catch (e) {
      show(errText(e), 'error');
      setRefreshingPrices(false);
    }
  };

  // Collection is loaded up front so the header stats are live on first paint.
  useEffect(() => { loadDecks(); loadCollection(); loadPrices(); }, [loadDecks, loadCollection, loadPrices]);

  // Newly discovered decks default to "enabled" in the collection deck filter.
  useEffect(() => {
    setEnabledDeckIds(prev => {
      const next = { ...prev };
      let added = false;
      decks.forEach(d => { if (next[d.id] === undefined) { next[d.id] = true; added = true; } });
      return added ? next : prev;
    });
  }, [decks]);

  // ── Card detail modal ──
  const openCardDetail = async (c: CollectionCard) => {
    setDetailCard(c);
    setCardDetail(null);
    setCardDetailLoading(true);
    try {
      setCardDetail(await api.getCardDetails(c.scryfall_id));
    } catch (e) { show(errText(e), 'error'); }
    finally { setCardDetailLoading(false); }
  };

  const closeCardDetail = () => { setDetailCard(null); setCardDetail(null); };

  // ── Tab switch ──
  const switchTab = useCallback((t: TabValue) => {
    setTab(t);
    if (t === 'collection') loadCollection();
  }, [loadCollection]);

  const globalSearch = useCallback((q: string) => {
    setSearchQuery(q);
    switchTab('collection');
  }, [switchTab]);

  // ── Deck CRUD ──
  const createDeck = async () => {
    if (!deckName.trim() || !deckCards.trim()) { show('Name and card list required', 'error'); return; }
    setCreating(true);
    try {
      const r = await api.createDeck(deckName.trim(), deckCards.trim(), deckColor);
      show(`"${r.name}" created (${r.results.length} cards)`, 'success');
      setDeckName(''); setDeckCards(''); setDeckColor(DEFAULT_DECK_COLOR); setAddOpen(false);
      loadDecks();
    } catch (e) { show(errText(e), 'error'); } finally { setCreating(false); }
  };

  const importMox = async () => {
    if (!moxUrl.trim()) { show('Enter a Moxfield URL', 'error'); return; }
    setImporting(true);
    try {
      const r = await api.importMoxfield(moxUrl.trim(), moxColor);
      show(`"${r.name}" imported (${r.results.length} cards)`, 'success');
      setMoxUrl(''); setAddOpen(false); loadDecks(); setTimeout(() => pollImages(r.id), 2000);
    } catch (e) { show(errText(e), 'error'); } finally { setImporting(false); }
  };

  const pollImages = (id: number, n = 0) => {
    if (n >= 5) return;
    api.getDeckCards(id).then(cards => { if (cards.some(c => !c.image_url) && n < 5) setTimeout(() => pollImages(id, n + 1), 2000); loadDecks(); if (modalDeck?.id === id) loadModal(id); }).catch(() => {});
  };

  const refreshImages = async () => {
    setRefreshingImages(true);
    show('Refreshing images…', 'info');
    try { await api.refreshAllImages(); loadDecks(); loadCollection(); }
    catch (e) { show(errText(e), 'error'); }
    finally { setRefreshingImages(false); }
  };

  const openDeck = async (deck: Deck) => {
    setModalDeck(deck); loadModal(deck.id);
    try { const [s, ci] = await Promise.all([api.getDeckStats(deck.id), api.getDeckColorIdentity(deck.id)]); setModalStats(s); setModalCI(ci.color_identity); } catch {}
  };

  const loadModal = async (id: number) => { try { setModalCards(await api.getDeckCards(id)); } catch {} };

  const closeModal = () => { setModalDeck(null); setModalCards([]); setModalSearch(''); setAddCardsText(''); setAddCardsResults([]); setShowCommanderPicker(false); loadDecks(); };

  const renameDeck = async () => {
    if (!modalDeck) return;
    const n = window.prompt('New deck name:', modalDeck.name);
    if (!n?.trim()) return;
    try { await api.renameDeck(modalDeck.id, n.trim()); setModalDeck({ ...modalDeck, name: n.trim() }); loadDecks(); } catch (e) { show(errText(e), 'error'); }
  };

  const deleteDeck = async () => {
    if (!modalDeck || !window.confirm(`Delete "${modalDeck.name}"?`)) return;
    try { await api.deleteDeck(modalDeck.id); show('Deleted', 'info'); closeModal(); } catch (e) { show(errText(e), 'error'); }
  };

  const addCards = async () => {
    if (!addCardsText.trim() || !modalDeck) return;
    setAddCardsLoading(true); setAddCardsResults([]);
    try { const r = await api.addCards(modalDeck.id, addCardsText.trim()); setAddCardsResults(r.results); setAddCardsText(''); loadModal(modalDeck.id); } catch (e) { show(errText(e), 'error'); } finally { setAddCardsLoading(false); }
  };

  /** Writes the full commander selection (0, 1 or 2 slots) and mirrors it locally. */
  const setCommanders = async (picks: CommanderPick[]) => {
    if (!modalDeck) return;
    const [first, second] = picks;
    try {
      await api.updateDeckCommander(
        modalDeck.id,
        first?.name ?? '', first?.image ?? '',
        second?.name ?? '', second?.image ?? '',
      );
      setModalDeck({
        ...modalDeck,
        commander_name: first?.name ?? '', commander_image_url: first?.image ?? '',
        commander2_name: second?.name ?? '', commander2_image_url: second?.image ?? '',
      });
      loadDecks();
    } catch (e) { show(errText(e), 'error'); }
  };

  /**
   * Toggle a legendary creature in/out of the commander slots. Picking a third
   * pushes out the oldest selection, so a click always does something visible.
   */
  const toggleCommander = (card: Card) => {
    if (!modalDeck) return;
    const current = deckCommanders(modalDeck);
    const idx = current.findIndex(c => c.name === card.card_name);
    if (idx >= 0) return setCommanders(current.filter((_, i) => i !== idx));
    const pick = { name: card.card_name, image: card.image_url || '' };
    return setCommanders([...current.slice(current.length < 2 ? 0 : 1), pick]);
  };

  // ── Collection filters ──
  const allDecksOn = decks.every(d => enabledDeckIds[d.id]);
  const toggleDeck = (id: number) => setEnabledDeckIds(p => ({ ...p, [id]: !p[id] }));
  const toggleAll = () => { const on = allDecksOn; setEnabledDeckIds(p => { const n = { ...p }; decks.forEach(d => { n[d.id] = !on; }); return n; }); };
  // Enabled deck names, for showing only filtered decks' dots under each card.
  const enabledDeckNames = useMemo(
    () => new Set(decks.filter(d => enabledDeckIds[d.id]).map(d => d.name)),
    [decks, enabledDeckIds],
  );

  const filteredCollection = allCollection.filter(c => {
    const eIds = Object.keys(enabledDeckIds).filter(id => enabledDeckIds[Number(id)]);
    if (eIds.length < Object.keys(enabledDeckIds).length && eIds.length > 0) { if (!c.decks?.some(d => decks.find(dd => dd.name === d.name && enabledDeckIds[dd.id]))) return false; }
    else if (eIds.length === 0) return false;
    if (typeFilter !== 'all' && !(c.type_line || '').toLowerCase().includes(typeFilter)) return false;
    if (searchQuery && !c.card_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Cards eligible for a commander slot: legendary creatures, plus Backgrounds
  // (legendary enchantments) for "Choose a Background" pairs.
  const commanderCandidates = modalCards.filter(c => {
    const tl = (c.type_line || '').toLowerCase();
    return (tl.includes('legendary') && tl.includes('creature')) || tl.includes('background');
  });

  const modalCommanders = modalDeck ? deckCommanders(modalDeck) : [];

  const totalCards = useMemo(
    () => allCollection.reduce((sum, c) => sum + (c.total_quantity || 0), 0),
    [allCollection],
  );

  // Deck id → its paper value + 30d move, for the deck rows.
  const deckValues = useMemo(
    () => new Map((priceSummary?.decks ?? []).map(d => [d.id, d])),
    [priceSummary],
  );

  // ─── RENDER ───

  return (
    <div>
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}
      </div>

      {/* ═══ HEADER ═══ */}
      <Header
        deckCount={decks.length}
        uniqueCards={allCollection.length}
        totalCards={totalCards}
        priceSummary={priceSummary}
        onSearch={globalSearch}
      />

      {/* ═══ TABS ═══ */}
      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(({ value, label }, i) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value}
            className="tab" onClick={() => switchTab(value)}>
            <span className="tab-idx">{String(i + 1).padStart(2, '0')}</span>
            {label}
          </button>
        ))}
      </nav>

      {/* ═══════════════════ D E C K S   T A B ═══════════════════ */}
      {tab === 'decks' && (
        <div className="page">

          {/* ─── Deck List ─── */}
          <div className="section-head">
            <span className="sec-idx">01</span>
            <h2>My Decks</h2>
            <button type="button" className="btn-ghost head-action" onClick={refreshPrices} disabled={refreshingPrices}>
              <RefreshCw className={refreshingPrices ? 'spin' : undefined} aria-hidden="true" />
              Refresh Prices
            </button>
            <button type="button" className="btn-ghost head-action" onClick={refreshImages} disabled={refreshingImages}>
              <RefreshCw className={refreshingImages ? 'spin' : undefined} aria-hidden="true" />
              Refresh Images
            </button>
            <button type="button" className="btn head-action" onClick={() => openAdd()}>
              <Plus aria-hidden="true" />
              Add Deck
            </button>
          </div>

          {decksLoading ? (
            <div className="empty-state"><Spinner size={22} /></div>
          ) : decks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-emblem" aria-hidden="true">
                <CommanderFrame commanders={[]} size="lg" />
              </span>
              <h3 className="empty-title">No decks on the table</h3>
              <p>Paste a decklist or import from Moxfield — your commander, curve and paper value land here.</p>
              <button type="button" className="btn" onClick={() => openAdd()}>
                <Plus size={14} aria-hidden="true" />
                Add Deck
              </button>
            </div>
          ) : (
            <div className="deck-list">
              {decks.map(deck => {
                const cmds = deckCommanders(deck);
                const value = deckValues.get(deck.id);
                return (
                <button key={deck.id} type="button"
                  className="deck-row"
                  style={{ '--deck-color': deck.color } as CSSProperties}
                  onClick={() => openDeck(deck)}
                >
                  <CommanderFrame commanders={cmds} color={deck.color} size="lg" />

                  <span className="deck-row-main">
                    <span className="deck-name">{deck.name}</span>
                    {cmds.length > 0 ? (
                      <span className="deck-commander">
                        <span>{cmds.map(c => c.name).join(' // ')}</span>
                      </span>
                    ) : (
                      <span className="deck-commander is-unset">No commander set — pick after import</span>
                    )}
                    <span className="deck-row-foot">
                      <ColorIdentity identity={deck.color_identity} size="sm" />
                      <MiniManaCurve stats={deckStats[deck.id] || null} />
                    </span>
                  </span>

                  <span className="deck-stats">
                    {value && value.value > 0
                      ? <span className="deck-value">{fmtEur(value.value)}</span>
                      : <span className="deck-value is-empty">——</span>}
                    {value && <PriceDelta delta={value.delta_30d} />}
                    <span className="deck-count">
                      {deck.card_count}<span className="deck-count-sep">/</span>{deck.total_cards}
                    </span>
                    <span className="deck-count-label">unique / total</span>
                  </span>
                </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ C O L L E C T I O N   T A B ═══════════════════ */}
      {tab === 'collection' && (
        <div className="page">
          <div className="section-head">
            <span className="sec-idx">02</span>
            <h2>Collection</h2>
            <span className="head-action head-note">
              {filteredCollection.length} of {allCollection.length} shown
            </span>
          </div>

          {/* Ledger band */}
          <div className="ledger">
            <div className="ledger-cell">
              <span className="ledger-label">Paper value</span>
              <span className="ledger-value">{priceSummary ? fmtEur(priceSummary.total) : '—'}</span>
            </div>
            <div className="ledger-cell">
              <span className="ledger-label">30d change</span>
              {priceSummary && priceSummary.delta_30d !== null
                ? <span className="ledger-value"><PriceDelta delta={priceSummary.delta_30d} suffix="" /></span>
                : <span className="ledger-value is-empty">—</span>}
            </div>
            <div className="ledger-cell">
              <span className="ledger-label">Unique cards</span>
              <span className="ledger-value">{allCollection.length.toLocaleString()}</span>
            </div>
            <div className="ledger-cell">
              <span className="ledger-label">Total cards</span>
              <span className="ledger-value">{totalCards.toLocaleString()}</span>
            </div>
          </div>

          {/* Value over time */}
          <ValueHistoryPanel onError={showError} />

          <div className="filters">
            {/* Type filter */}
            <div className="filter-row">
              <span className="filter-label">Type</span>
              {TYPE_FILTERS.map(t => (
                <button key={t.value} type="button" className="chip" aria-pressed={typeFilter === t.value}
                  onClick={() => setTypeFilter(t.value)}>
                  {t.glyph && <i className={`ms ms-${t.glyph}`} aria-hidden="true" />}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Deck filter */}
            <div className="filter-row">
              <span className="filter-label">Decks</span>
              <button type="button" className="chip" aria-pressed={allDecksOn} onClick={toggleAll}>All</button>
              {decks.map(d => (
                <button key={d.id} type="button" className="chip chip-deck" aria-pressed={!!enabledDeckIds[d.id]}
                  style={{ '--deck-color': d.color } as CSSProperties}
                  onClick={() => toggleDeck(d.id)} title={d.name}>
                  {d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <input type="search" className="field search-field"
            placeholder={`Search ${allCollection.length.toLocaleString()} cards…`} aria-label="Search cards"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

          {/* Grid */}
          {filteredCollection.length === 0 ? (
            <div className="empty-state">
              <span className="empty-emblem" aria-hidden="true"><LibraryBig /></span>
              <h3 className="empty-title">{allCollection.length === 0 ? 'The binder is empty' : 'Nothing matches'}</h3>
              <p>{allCollection.length === 0
                ? 'Your collection is built from your decks — add one and every card is catalogued and priced.'
                : 'No cards match these filters. Widen the type or deck selection.'}</p>
              {allCollection.length === 0 ? (
                <button type="button" className="btn" onClick={() => { switchTab('decks'); openAdd(); }}>
                  <Plus size={14} aria-hidden="true" />
                  Add Deck
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={() => {
                  setTypeFilter('all'); setSearchQuery('');
                  setEnabledDeckIds(Object.fromEntries(decks.map(d => [d.id, true])));
                }}>
                  <X size={14} aria-hidden="true" />
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="card-grid">
              {filteredCollection.map(c => (
                <button key={c.scryfall_id || c.card_name} type="button"
                  className="coll-card"
                  onClick={() => openCardDetail(c)}
                >
                  <span className="qty-badge">×{c.total_quantity}</span>
                  {c.is_foil ? <span className="foil-badge corner">Foil</span> : null}

                  {c.image_url ? (
                    <span className="coll-art-wrap">
                      <img className="coll-art" src={c.image_url} alt={c.card_name} loading="lazy" />
                      {c.is_foil ? <span className="foil-sheen" /> : null}
                    </span>
                  ) : (
                    <span className="coll-art-empty">
                      {c.mana_cost ? <ManaCost cost={c.mana_cost} size="lg" /> : <ImageOff aria-hidden="true" />}
                    </span>
                  )}

                  <span className="coll-body">
                    <span className="coll-name">{c.card_name}</span>
                    <span className="coll-type">{c.type_line?.split('—')[0]?.trim() || ''}</span>
                    <span className="coll-meta">
                      {c.set_code && <span className="coll-set">{c.set_code.toUpperCase()}</span>}
                      {c.set_code && <span>·</span>}
                      <span>{c.deck_count} deck{c.deck_count !== 1 ? 's' : ''}</span>
                    </span>
                    {/* Unit price only — the ×qty arithmetic lives in the modal. */}
                    <CardPrice card={c} />
                    <span className="coll-foot">
                      {c.decks?.filter(d => enabledDeckNames.has(d.name)).map(d => (
                        <span key={d.name} className="deck-dot" style={{ background: d.color }} title={d.name} />
                      ))}
                      <ColorIdentity identity={c.color_identity} size="sm" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ M E T A   T A B ═══════════════════ */}
      {tab === 'meta' && <MetaTab decks={decks} onError={showError} />}

      {/* ═══════════════════ M U L L I G A N S   T A B ═══════════════════ */}
      {tab === 'mulligans' && <MulliganTab decks={decks} onError={showError} />}

      {/* ═══════════════════ A D D   D E C K   M O D A L ═══════════════════ */}
      {addOpen && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className="modal-panel add-deck-modal" role="dialog" aria-modal="true" aria-label="Add deck"
            style={{ maxWidth: 560, '--deck-color': addMode === 'paste' ? deckColor : moxColor } as CSSProperties}>
            <div className="modal-head">
              <div className="add-deck-title">
                <CommanderFrame commanders={[]} color={addMode === 'paste' ? deckColor : moxColor} size="md" />
                <div style={{ minWidth: 0 }}>
                  <h2 className="modal-title">Add Deck</h2>
                  <div className="modal-sub">
                    {addMode === 'paste'
                      ? 'One card per line. Commander is picked after import.'
                      : 'Public Moxfield deck URL — commander and art come along.'}
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="icon-btn bare" onClick={() => setAddOpen(false)} aria-label="Close"><X /></button>
              </div>
            </div>
            <div className="segmented" role="tablist" aria-label="Add method">
              <button type="button" role="tab" className="segmented-opt" aria-selected={addMode === 'paste'} onClick={() => setAddMode('paste')}>
                <ClipboardList aria-hidden="true" /> Paste list
              </button>
              <button type="button" role="tab" className="segmented-opt" aria-selected={addMode === 'moxfield'} onClick={() => setAddMode('moxfield')}>
                <Link aria-hidden="true" /> Import Moxfield
              </button>
            </div>
            {addMode === 'paste' ? (
              <div className="add-deck-form">
                <div className="add-deck-row">
                  <input type="text" className="field" autoFocus placeholder="Deck name" value={deckName}
                    onChange={e => setDeckName(e.target.value)} />
                  <input type="color" className="swatch-input" aria-label="Deck colour"
                    value={deckColor} onChange={e => setDeckColor(e.target.value)} />
                </div>
                <textarea className="field" style={{ minHeight: 220 }}
                  placeholder={'1 Thassa\'s Oracle\n1 Demonic Consultation\n1 Mana Crypt'}
                  value={deckCards} onChange={e => setDeckCards(e.target.value)} />
                <div className="add-deck-actions">
                  <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                  <button type="button" className="btn" onClick={createDeck} disabled={creating}>
                    {creating ? <Spinner size={14} inline /> : null}
                    {creating ? 'Validating…' : 'Create Deck'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="add-deck-form">
                <div className="add-deck-row">
                  <input type="text" className="field" autoFocus placeholder="https://moxfield.com/decks/…" value={moxUrl}
                    onChange={e => setMoxUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && importMox()} />
                  <input type="color" className="swatch-input" aria-label="Deck colour"
                    value={moxColor} onChange={e => setMoxColor(e.target.value)} />
                </div>
                <div className="add-deck-actions">
                  <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                  <button type="button" className="btn" onClick={importMox} disabled={importing}>
                    {importing ? <Spinner size={14} inline /> : null}
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ D E C K   M O D A L ═══════════════════ */}
      {modalDeck && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-panel deck-modal" style={{ maxWidth: 720, '--deck-color': modalDeck.color } as CSSProperties} role="dialog" aria-modal="true" aria-label={modalDeck.name}>
            {/* Header */}
            <div className="modal-head">
              <div style={{ minWidth: 0 }}>
                <h2 className="modal-title">{modalDeck.name}</h2>
                <div className="identity-line">
                  <span className="meta-label">Identity</span>
                  <ColorIdentity identity={modalCI} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="icon-btn" onClick={renameDeck} aria-label="Rename deck" title="Rename deck"><Pencil /></button>
                <button type="button" className="icon-btn danger" onClick={deleteDeck} aria-label="Delete deck" title="Delete deck"><Trash2 /></button>
                <button type="button" className="icon-btn bare" onClick={closeModal} aria-label="Close"><X /></button>
              </div>
            </div>

            {/* Mana curve */}
            <FullManaCurve stats={modalStats} />

            {/* Commanders */}
            <div className="deck-modal-cmd">
              <div className="deck-modal-cmd-row">
                <CommanderFrame commanders={modalCommanders} color={modalDeck.color} identity={modalCI} size="lg" />
                <div style={{ minWidth: 0 }}>
                  <div className="meta-label">{modalCommanders.length > 1 ? 'Commanders' : 'Commander'}</div>
                  {modalCommanders.length > 0 ? (
                    modalCommanders.map(c => (
                      <div key={c.name} className="deck-modal-cmd-name">
                        <Crown size={13} aria-hidden="true" />
                        {c.name}
                      </div>
                    ))
                  ) : (
                    <div className="deck-modal-cmd-unset">Not set</div>
                  )}
                </div>
                {commanderCandidates.length > 0 && (
                  <button type="button" className="btn-ghost" style={{ marginLeft: 'auto' }}
                    onClick={() => setShowCommanderPicker(!showCommanderPicker)}>
                    {showCommanderPicker ? 'Done' : 'Change'}
                  </button>
                )}
              </div>
              {showCommanderPicker && commanderCandidates.length > 0 && (
                <div className="slide-down picker-list">
                  <div className="meta-label" style={{ padding: '8px 0' }}>
                    Pick up to two (partner, background, friends forever) — a third replaces the first
                  </div>
                  {commanderCandidates.map(c => {
                    const picked = modalCommanders.some(m => m.name === c.card_name);
                    return (
                      <button key={c.id} type="button" className="picker-option" role="checkbox"
                        aria-checked={picked} onClick={() => toggleCommander(c)}>
                        <CommanderFrame commanders={[{ name: c.card_name, image: c.image_url || '' }]}
                          color={modalDeck.color} size="xs" active={picked} />
                        {c.card_name}
                        {picked && <Check size={14} aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                  <button type="button" className="picker-option is-clear"
                    onClick={() => setCommanders([])}>
                    <X size={14} aria-hidden="true" />
                    {modalCommanders.length > 1 ? 'Clear commanders' : 'Clear commander'}
                  </button>
                </div>
              )}
            </div>

            {/* Card search */}
            <input type="search" className="field search-field"
              placeholder="Search cards in deck…" aria-label="Search cards in deck"
              value={modalSearch} onChange={e => setModalSearch(e.target.value)} />

            {/* Card list */}
            <div className="card-list">
              {modalCards.filter(c => !modalSearch || c.card_name.toLowerCase().includes(modalSearch.toLowerCase())).map(c => (
                <div key={c.id} className="card-row">
                  <CardImage url={c.image_url} name={c.card_name} size={28} />
                  <div className="card-row-body">
                    <div className="card-row-name">{c.card_name}</div>
                    <ManaCost cost={c.mana_cost} />
                  </div>
                  <button type="button" className={`foil-badge${c.is_foil ? '' : ' off'}`}
                    aria-pressed={!!c.is_foil} title="Toggle foil"
                    onClick={() => { api.updateCard(c.id, { is_foil: c.is_foil ? 0 : 1 }).then(() => loadModal(modalDeck.id)); }}>
                    {c.is_foil ? 'Foil' : 'Non'}
                  </button>
                  <input type="number" className="qty-input" value={c.quantity} min={1} aria-label={`Quantity of ${c.card_name}`}
                    onChange={e => { api.updateCard(c.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) }); }} />
                  <button type="button" className="icon-btn bare danger" aria-label={`Remove ${c.card_name}`}
                    onClick={() => { api.deleteCard(c.id).then(() => loadModal(modalDeck.id)); }}>
                    <X />
                  </button>
                </div>
              ))}
            </div>

            {/* Add cards */}
            <div className="modal-section">
              <textarea className="field" style={{ minHeight: 62, marginBottom: 10 }}
                placeholder="Paste cards…" value={addCardsText} onChange={e => setAddCardsText(e.target.value)} />
              <button type="button" className="btn" onClick={addCards} disabled={addCardsLoading}>
                {addCardsLoading ? <Spinner size={14} inline /> : null}
                {addCardsLoading ? 'Validating…' : 'Add Cards'}
              </button>
              {addCardsResults.length > 0 && (
                <div className="result-list">
                  {addCardsResults.map((r, i) => (
                    <div key={i} className={`result-row ${r.status === 'ok' ? 'ok' : 'bad'}`}>
                      {r.status === 'ok' ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
                      <span>{r.requested} ×{r.quantity}</span>
                      <span className="result-resolved">{r.status === 'ok' ? r.resolved : 'Not found'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-foot">
              <span className="modal-foot-note">{modalDeck.card_count} cards</span>
              <button type="button" className="btn-ghost" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ C A R D   D E T A I L   M O D A L ═══════════════════ */}
      {detailCard && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeCardDetail(); }}>
          <div className="modal-panel" style={{ maxWidth: 780 }} role="dialog" aria-modal="true" aria-label={detailCard.card_name}>
            {/* Header */}
            <div className="modal-head">
              <div style={{ minWidth: 0 }}>
                <h2 className="modal-title">{cardDetail?.name_en || detailCard.card_name}</h2>
                {detailCard.type_line && <div className="modal-sub">{detailCard.type_line}</div>}
              </div>
              <div className="modal-actions">
                <ManaCost cost={detailCard.mana_cost} size="md" />
                <button type="button" className="icon-btn bare" onClick={closeCardDetail} aria-label="Close"><X /></button>
              </div>
            </div>

            <div className="detail-layout">
              {/* Card image */}
              <div className="detail-side">
                {detailCard.image_url ? (
                  <img className="detail-art" src={detailCard.image_url} alt={detailCard.card_name} />
                ) : (
                  <div className="detail-art-empty">No image</div>
                )}
                <div className="detail-print">
                  <ColorIdentity identity={detailCard.color_identity} />
                  {detailCard.set_code && <span className="detail-set">{detailCard.set_code.toUpperCase()}</span>}
                  {detailCard.is_foil ? <span className="foil-badge">Foil</span> : null}
                </div>
                <PriceBox card={detailCard} quantity={detailCard.total_quantity} />
                <CardSparkline scryfallId={detailCard.scryfall_id} isFoil={!!detailCard.is_foil} />
              </div>

              {/* Info column */}
              <div className="detail-main">
                {cardDetailLoading ? (
                  <div className="detail-loading"><Spinner size={20} /></div>
                ) : cardDetail ? (
                  <>
                    {/* Localized names */}
                    <div className="detail-names">
                      {([['English', cardDetail.name_en], ['Deutsch', cardDetail.name_de], ['日本語', cardDetail.name_ja]] as const).map(([label, value]) => (
                        <div key={label} className="detail-name-row">
                          <span className="meta-label">{label}</span>
                          <span className="detail-name">{value || '—'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Decks included */}
                    <div className="detail-block">
                      <div className="meta-label">
                        Included in {detailCard.deck_count} deck{detailCard.deck_count !== 1 ? 's' : ''}
                      </div>
                      {detailCard.decks && detailCard.decks.length > 0 ? (
                        <div className="detail-decks">
                          {detailCard.decks.map(d => (
                            <div key={d.name} className="detail-deck">
                              <span className="deck-dot" style={{ background: d.color }} />
                              {d.name}
                            </div>
                          ))}
                        </div>
                      ) : <div className="detail-muted" style={{ marginTop: 6 }}>Not currently in any deck.</div>}
                    </div>

                    {/* Oracle text */}
                    {cardDetail.oracle_text
                      ? <div className="oracle-text"><OracleText text={cardDetail.oracle_text} /></div>
                      : null}
                  </>
                ) : <div className="detail-loading detail-muted">Could not load card details.</div>}
              </div>
            </div>

            {/* Rulings */}
            <div className="modal-section">
              <div className="meta-label">
                Rulings{cardDetail && cardDetail.rulings.length > 0 ? ` (${cardDetail.rulings.length})` : ''}
              </div>
              {cardDetailLoading ? (
                <div className="detail-loading"><Spinner /></div>
              ) : cardDetail && cardDetail.rulings.length > 0 ? (
                <div className="rulings">
                  {cardDetail.rulings.map((r, i) => (
                    <div key={i} className="ruling">
                      <div>{r.comment}</div>
                      {r.published_at && <div className="ruling-date">{r.published_at.slice(0, 10)}</div>}
                    </div>
                  ))}
                </div>
              ) : (!cardDetailLoading && cardDetail !== null) ? (
                <div className="detail-muted" style={{ marginTop: 8 }}>No rulings found for this card.</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
