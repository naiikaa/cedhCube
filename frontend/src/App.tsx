import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import {
  Check, CircleCheck, CircleX, Crown, ImageOff, Layers, LibraryBig, Pencil, RefreshCw, Trash2, X,
} from 'lucide-react';
import { api } from './lib/api';
import type { Deck, Card, CollectionCard, CardResult, CmcStats, CardDetail } from './lib/types';
import { ColorIdentity } from './components/ColorIdentity';
import { ManaCost, OracleText } from './components/ManaPip';
import { FullManaCurve, MiniManaCurve } from './components/ManaCurve';
import { Header } from './components/Header';
import { CardImage, Spinner } from './components/UI';
import { useToast, Toast } from './components/Toast';

const TABS = [
  { value: 'decks', label: 'Decks', Icon: Layers },
  { value: 'collection', label: 'Collection', Icon: LibraryBig },
] as const;

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

/** One commander slot, in list order (slot 1 first). */
type CommanderPick = { name: string; image: string };

/**
 * A deck's commanders as a 0–2 entry list, so every surface can iterate instead
 * of branching on the two column pairs. Partner decks fill both slots.
 */
const deckCommanders = (deck: Deck): CommanderPick[] =>
  [
    { name: deck.commander_name, image: deck.commander_image_url },
    { name: deck.commander2_name, image: deck.commander2_image_url },
  ].filter(c => !!c.name);

// ─── App ───
export default function App() {
  const [tab, setTab] = useState<'decks' | 'collection'>('decks');
  const { show, toasts, remove } = useToast();

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

  // Collection is loaded up front so the header stats are live on first paint.
  useEffect(() => { loadDecks(); loadCollection(); }, [loadDecks, loadCollection]);

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
  const switchTab = useCallback((t: 'decks' | 'collection') => {
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
      setDeckName(''); setDeckCards(''); setDeckColor(DEFAULT_DECK_COLOR);
      loadDecks();
    } catch (e) { show(errText(e), 'error'); } finally { setCreating(false); }
  };

  const importMox = async () => {
    if (!moxUrl.trim()) { show('Enter a Moxfield URL', 'error'); return; }
    setImporting(true);
    try {
      const r = await api.importMoxfield(moxUrl.trim(), moxColor);
      show(`"${r.name}" imported (${r.results.length} cards)`, 'success');
      setMoxUrl(''); loadDecks(); setTimeout(() => pollImages(r.id), 2000);
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

  // ─── RENDER ───

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}
      </div>

      {/* ═══ HEADER ═══ */}
      <Header
        deckCount={decks.length}
        uniqueCards={allCollection.length}
        totalCards={totalCards}
        onSearch={globalSearch}
      />

      {/* ═══ TABS ═══ */}
      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(({ value, label, Icon }) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value}
            className="tab" onClick={() => switchTab(value)}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {/* ═══════════════════ D E C K S   T A B ═══════════════════ */}
      {tab === 'decks' && (
        <div className="page">

          {/* ─── Import ─── */}
          <section className="frame frame-pad" style={{ marginBottom: '1.25rem' }}>
            <div className="section-head">
              <h3>Import from Moxfield</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" className="field" style={{ flex: 1, minWidth: 220, width: 'auto' }}
                placeholder="https://moxfield.com/decks/…" value={moxUrl}
                onChange={e => setMoxUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && importMox()} />
              <input type="color" className="swatch-input" aria-label="Deck colour"
                value={moxColor} onChange={e => setMoxColor(e.target.value)} />
              <button type="button" className="btn" onClick={importMox} disabled={importing}>
                {importing ? <Spinner size={14} inline /> : null}
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </section>

          {/* ─── Create ─── */}
          <section className="frame frame-pad" style={{ marginBottom: '1.75rem' }}>
            <div className="section-head">
              <h3>New Deck</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <input type="text" className="field" style={{ flex: 1, minWidth: 200, width: 'auto' }}
                placeholder="Deck name" value={deckName} onChange={e => setDeckName(e.target.value)} />
              <input type="color" className="swatch-input" aria-label="Deck colour"
                value={deckColor} onChange={e => setDeckColor(e.target.value)} />
            </div>
            <textarea className="field mono" style={{ minHeight: 92, marginBottom: 10 }}
              placeholder={'4 Lightning Bolt\n3x Counterspell\n1 Black Lotus (LEA)'}
              value={deckCards} onChange={e => setDeckCards(e.target.value)} />
            <button type="button" className="btn" onClick={createDeck} disabled={creating}>
              {creating ? <Spinner size={14} inline /> : null}
              {creating ? 'Validating…' : 'Create Deck'}
            </button>
          </section>

          {/* ─── Deck List ─── */}
          <div className="section-head">
            <h2>My Decks</h2>
            <button type="button" className="btn-ghost head-action" onClick={refreshImages} disabled={refreshingImages}>
              <RefreshCw className={refreshingImages ? 'spin' : undefined} aria-hidden="true" />
              Refresh Images
            </button>
          </div>

          {decksLoading ? (
            <div className="empty-state"><Spinner size={22} /></div>
          ) : decks.length === 0 ? (
            <div className="empty-state">
              <Layers aria-hidden="true" />
              No decks yet — import one from Moxfield or paste a list above.
            </div>
          ) : (
            <div className="deck-list">
              {decks.map(deck => {
                const cmds = deckCommanders(deck);
                return (
                <button key={deck.id} type="button"
                  className="frame frame-hover deck-row"
                  style={{ '--deck-color': deck.color } as CSSProperties}
                  onClick={() => openDeck(deck)}
                >
                  {cmds.length > 1 ? (
                    <span className="cmd-art-pair">
                      {cmds.map(c => (c.image ? (
                        <img key={c.name} className="cmd-art pair" src={c.image} alt="" loading="lazy" />
                      ) : (
                        <span key={c.name} className="cmd-placeholder pair"><Crown aria-hidden="true" /></span>
                      )))}
                    </span>
                  ) : deck.commander_image_url ? (
                    <img className="cmd-art" src={deck.commander_image_url} alt="" loading="lazy" />
                  ) : (
                    <span className="cmd-placeholder"><Crown aria-hidden="true" /></span>
                  )}

                  <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <span className="deck-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</span>
                      <ColorIdentity identity={deck.color_identity} size="sm" />
                    </span>
                    {cmds.length > 0 && (
                      <span className="deck-commander">
                        <Crown aria-hidden="true" />
                        <span>{cmds.map(c => c.name).join(' // ')}</span>
                      </span>
                    )}
                    <MiniManaCurve stats={deckStats[deck.id] || null} />
                  </span>

                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{deck.card_count} cards</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{deck.total_cards} total</span>
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
            <h2>Collection</h2>
            <span className="head-action" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {filteredCollection.length} of {allCollection.length}
            </span>
          </div>

          {/* Search */}
          <input type="search" className="field" style={{ marginBottom: 12 }}
            placeholder="Search cards…" aria-label="Search cards"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

          {/* Type filter */}
          <div className="filter-row" style={{ marginBottom: 8 }}>
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
          <div className="filter-row" style={{ marginBottom: 18 }}>
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

          {/* Grid */}
          {filteredCollection.length === 0 ? (
            <div className="empty-state">
              <LibraryBig aria-hidden="true" />
              {allCollection.length === 0 ? 'No cards yet — add a deck to build your collection.' : 'No cards match these filters.'}
            </div>
          ) : (
            <div className="card-grid">
              {filteredCollection.map(c => (
                <button key={c.scryfall_id || c.card_name} type="button"
                  className="frame frame-hover coll-card"
                  onClick={() => openCardDetail(c)}
                >
                  <span className="qty-badge">×{c.total_quantity}</span>
                  {c.is_foil ? <span className="foil-badge corner">Foil</span> : null}

                  {c.image_url ? (
                    <span style={{ position: 'relative', display: 'block' }}>
                      <img className="coll-art" src={c.image_url} alt={c.card_name} loading="lazy" />
                      {c.is_foil ? <span className="foil-sheen" /> : null}
                    </span>
                  ) : (
                    <span className="coll-art-empty">
                      {c.mana_cost ? <ManaCost cost={c.mana_cost} size="lg" /> : <ImageOff aria-hidden="true" />}
                    </span>
                  )}

                  <span className="coll-body" style={{ display: 'block' }}>
                    <span className="coll-name" style={{ display: 'block' }}>{c.card_name}</span>
                    <span className="coll-type" style={{ display: 'block' }}>{c.type_line?.split('—')[0]?.trim() || ''}</span>
                    <span className="coll-meta">
                      {c.set_code && <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{c.set_code.toUpperCase()}</span>}
                      {c.set_code && <span>·</span>}
                      <span>{c.deck_count} deck{c.deck_count !== 1 ? 's' : ''}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
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

      {/* ═══════════════════ D E C K   M O D A L ═══════════════════ */}
      {modalDeck && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-panel" style={{ maxWidth: 720 }} role="dialog" aria-modal="true" aria-label={modalDeck.name}>
            {/* Header */}
            <div className="modal-head">
              <div style={{ minWidth: 0 }}>
                <h2 className="modal-title">
                  <span className="deck-dot" style={{ background: modalDeck.color, width: 11, height: 11 }} />
                  {modalDeck.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
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
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {modalCommanders.length > 0
                  ? modalCommanders.map(c => (c.image
                    ? <img key={c.name} className="cmd-art sm" src={c.image} alt="" />
                    : <span key={c.name} className="cmd-placeholder sm"><Crown aria-hidden="true" /></span>))
                  : <span className="cmd-placeholder"><Crown aria-hidden="true" /></span>}
                <div style={{ minWidth: 0 }}>
                  <div className="meta-label">{modalCommanders.length > 1 ? 'Commanders' : 'Commander'}</div>
                  {modalCommanders.length > 0 ? (
                    modalCommanders.map(c => (
                      <div key={c.name} className="display" style={{ fontSize: '0.9rem', color: 'var(--commander)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Crown size={13} aria-hidden="true" />
                        {c.name}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>Not set</div>
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
                <div className="slide-down" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="meta-label" style={{ marginBottom: 2 }}>
                    Pick up to two (partner, background, friends forever) — a third replaces the first
                  </div>
                  {commanderCandidates.map(c => {
                    const picked = modalCommanders.some(m => m.name === c.card_name);
                    return (
                      <button key={c.id} type="button" className="picker-option" role="checkbox"
                        aria-checked={picked} onClick={() => toggleCommander(c)}>
                        <CardImage url={c.image_url} name={c.card_name} size={24} />
                        {c.card_name}
                        {picked && <Check size={14} aria-hidden="true" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                  <button type="button" className="picker-option" style={{ color: 'var(--text-muted)' }}
                    onClick={() => setCommanders([])}>
                    <X size={14} aria-hidden="true" />
                    {modalCommanders.length > 1 ? 'Clear commanders' : 'Clear commander'}
                  </button>
                </div>
              )}
            </div>

            {/* Card search */}
            <input type="search" className="field" style={{ fontSize: '0.8rem', marginBottom: 10 }}
              placeholder="Search cards in deck…" aria-label="Search cards in deck"
              value={modalSearch} onChange={e => setModalSearch(e.target.value)} />

            {/* Card list */}
            <div style={{ marginBottom: 12 }}>
              {modalCards.filter(c => !modalSearch || c.card_name.toLowerCase().includes(modalSearch.toLowerCase())).map(c => (
                <div key={c.id} className="card-row">
                  <CardImage url={c.image_url} name={c.card_name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.card_name}</div>
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
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <textarea className="field mono" style={{ minHeight: 62, marginBottom: 8 }}
                placeholder="Paste cards…" value={addCardsText} onChange={e => setAddCardsText(e.target.value)} />
              <button type="button" className="btn" onClick={addCards} disabled={addCardsLoading}>
                {addCardsLoading ? <Spinner size={14} inline /> : null}
                {addCardsLoading ? 'Validating…' : 'Add Cards'}
              </button>
              {addCardsResults.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {addCardsResults.map((r, i) => (
                    <div key={i} className={`result-row ${r.status === 'ok' ? 'ok' : 'bad'}`}>
                      {r.status === 'ok' ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
                      <span>{r.requested} ×{r.quantity}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{r.status === 'ok' ? r.resolved : 'Not found'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{modalDeck.card_count} cards</span>
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

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {/* Card image */}
              <div style={{ flexShrink: 0, width: 220, maxWidth: '100%' }}>
                {detailCard.image_url ? (
                  <img src={detailCard.image_url} alt={detailCard.card_name}
                    style={{ width: '100%', height: 'auto', borderRadius: 'var(--frame-radius)', border: '1px solid var(--border)', display: 'block' }} />
                ) : (
                  <div className="frame" style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No image
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <ColorIdentity identity={detailCard.color_identity} />
                  {detailCard.set_code && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{detailCard.set_code.toUpperCase()}</span>}
                  {detailCard.is_foil ? <span className="foil-badge">Foil</span> : null}
                </div>
              </div>

              {/* Info column */}
              <div style={{ flex: 1, minWidth: 260 }}>
                {cardDetailLoading ? (
                  <div style={{ padding: '2rem 0', textAlign: 'center' }}><Spinner size={20} /></div>
                ) : cardDetail ? (
                  <>
                    {/* Localized names */}
                    <div style={{ marginBottom: 14 }}>
                      {([['English', cardDetail.name_en], ['Deutsch', cardDetail.name_de], ['日本語', cardDetail.name_ja]] as const).map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span className="meta-label" style={{ width: 76, flexShrink: 0 }}>{label}</span>
                          <span className="display" style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)' }}>{value || '—'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Decks included */}
                    <div style={{ marginBottom: 14 }}>
                      <div className="meta-label" style={{ display: 'block', marginBottom: 6 }}>
                        Included in {detailCard.deck_count} deck{detailCard.deck_count !== 1 ? 's' : ''}
                      </div>
                      {detailCard.decks && detailCard.decks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {detailCard.decks.map(d => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem' }}>
                              <span className="deck-dot" style={{ background: d.color, width: 11, height: 11 }} />
                              {d.name}
                            </div>
                          ))}
                        </div>
                      ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not currently in any deck.</div>}
                    </div>

                    {/* Oracle text */}
                    {cardDetail.oracle_text
                      ? <div className="oracle-text"><OracleText text={cardDetail.oracle_text} /></div>
                      : null}
                  </>
                ) : <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Could not load card details.</div>}
              </div>
            </div>

            {/* Rulings */}
            <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div className="meta-label" style={{ display: 'block', marginBottom: 8 }}>
                Rulings{cardDetail && cardDetail.rulings.length > 0 ? ` (${cardDetail.rulings.length})` : ''}
              </div>
              {cardDetailLoading ? (
                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}><Spinner /></div>
              ) : cardDetail && cardDetail.rulings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cardDetail.rulings.map((r, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', lineHeight: 1.45 }}>
                      <div style={{ color: 'var(--text)' }}>{r.comment}</div>
                      {r.published_at && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.published_at.slice(0, 10)}</div>}
                    </div>
                  ))}
                </div>
              ) : (!cardDetailLoading && cardDetail !== null) ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No rulings found for this card.</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
