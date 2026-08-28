import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme, THEMES } from './hooks/useTheme';
import { api } from './lib/api';
import type { Deck, Card, CollectionCard, CardResult, CmcStats, CardDetail } from './lib/types';
import { ColorIdentity } from './components/ColorIdentity';
import { FullManaCurve, MiniManaCurve } from './components/ManaCurve';
import { Spinner } from './components/UI';
import { useToast, Toast } from './components/Toast';

// ─── Styles (sx shorthand) ───
const sx = {
  header: {
    background: 'var(--bg-surface)', px: 6, py: 3,
    borderBottom: '2px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  } as const,
  input: {
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: 8,
    fontSize: '0.9rem', width: '100%', outline: 'none',
    transition: 'border-color 0.2s',
  } as const,
  btn: {
    background: 'var(--accent)', color: '#fff', border: 'none',
    padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 500,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    transition: 'all 0.2s',
  } as const,
  btnGhost: {
    background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)',
    padding: '0.4rem 0.75rem', borderRadius: 8, cursor: 'pointer',
    fontSize: '0.8rem', transition: 'all 0.2s',
  } as const,
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '1.5rem',
    transition: 'all 0.2s',
  } as const,
};

// ─── App ───
export default function App() {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<'decks' | 'collection'>('decks');
  const { show, toasts, remove } = useToast();

  // ── Decks ──
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [deckStats, setDeckStats] = useState<Record<number, CmcStats>>({});

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
  const [deckColor, setDeckColor] = useState('#e94560');
  const [creating, setCreating] = useState(false);
  const [moxUrl, setMoxUrl] = useState('');
  const [moxColor, setMoxColor] = useState('#e94560');
  const [importing, setImporting] = useState(false);

  // ── Load ──
  const loadDecks = useCallback(() => {
    setDecksLoading(true);
    api.getDecks().then(d => {
      setDecks(d);
      setDecksLoading(false);
      d.forEach(dd => api.getDeckStats(dd.id).then(s => setDeckStats(p => ({ ...p, [dd.id]: s }))).catch(() => {}));
    }).catch(e => { show(e.message, 'error'); setDecksLoading(false); });
  }, [show]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  const loadCollection = useCallback(() => {
    api.getCollection().then(cards => setAllCollection(cards)).catch(e => show(e.message, 'error'));
    api.getDecks().then(d => {
      setDecks(d);
      setEnabledDeckIds(p => { const n = { ...p }; d.forEach(dd => { if (n[dd.id] === undefined) n[dd.id] = true; }); return n; });
    }).catch(() => {});
  }, [show]);

  // ── Card detail modal ──
  const openCardDetail = async (c: CollectionCard) => {
    setDetailCard(c);
    setCardDetail(null);
    setCardDetailLoading(true);
    try {
      setCardDetail(await api.getCardDetails(c.scryfall_id));
    } catch (e: any) { show(e.message, 'error'); }
    finally { setCardDetailLoading(false); }
  };

  const closeCardDetail = () => { setDetailCard(null); setCardDetail(null); };

  // ── Tab switch ──
  const switchTab = useCallback((t: 'decks' | 'collection') => {
    setTab(t);
    if (t === 'collection') loadCollection();
  }, [loadCollection]);

  // ── Deck CRUD ──
  const createDeck = async () => {
    if (!deckName.trim() || !deckCards.trim()) { show('Name and card list required', 'error'); return; }
    setCreating(true);
    try {
      const r = await api.createDeck(deckName.trim(), deckCards.trim(), deckColor);
      show(`"${r.name}" created (${r.results.length} cards)`, 'success');
      setDeckName(''); setDeckCards(''); setDeckColor('#e94560');
      loadDecks();
    } catch (e: any) { show(e.message, 'error'); } finally { setCreating(false); }
  };

  const importMox = async () => {
    if (!moxUrl.trim()) { show('Enter a Moxfield URL', 'error'); return; }
    setImporting(true);
    try {
      const r = await api.importMoxfield(moxUrl.trim(), moxColor);
      show(`"${r.name}" imported (${r.results.length} cards)`, 'success');
      setMoxUrl(''); loadDecks(); setTimeout(() => pollImages(r.id), 2000);
    } catch (e: any) { show(e.message, 'error'); } finally { setImporting(false); }
  };

  const pollImages = (id: number, n = 0) => {
    if (n >= 5) return;
    api.getDeckCards(id).then(cards => { if (cards.some(c => !c.image_url) && n < 5) setTimeout(() => pollImages(id, n + 1), 2000); loadDecks(); if (modalDeck?.id === id) loadModal(id); }).catch(() => {});
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
    try { await api.renameDeck(modalDeck.id, n.trim()); setModalDeck({ ...modalDeck, name: n.trim() }); loadDecks(); } catch (e: any) { show(e.message, 'error'); }
  };

  const deleteDeck = async () => {
    if (!modalDeck || !window.confirm(`Delete "${modalDeck.name}"?`)) return;
    try { await api.deleteDeck(modalDeck.id); show('Deleted', 'info'); closeModal(); } catch (e: any) { show(e.message, 'error'); }
  };

  const addCards = async () => {
    if (!addCardsText.trim() || !modalDeck) return;
    setAddCardsLoading(true); setAddCardsResults([]);
    try { const r = await api.addCards(modalDeck.id, addCardsText.trim()); setAddCardsResults(r.results); setAddCardsText(''); loadModal(modalDeck.id); } catch (e: any) { show(e.message, 'error'); } finally { setAddCardsLoading(false); }
  };

  const setCommander = async (name: string, img: string) => {
    if (!modalDeck) return;
    try { await api.updateDeckCommander(modalDeck.id, name, img); setModalDeck({ ...modalDeck, commander_name: name, commander_image_url: img }); setShowCommanderPicker(false); loadDecks(); } catch {}
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

  const legendaryCreatures = modalCards.filter(c => {
    const tl = (c.type_line || '').toLowerCase(); return tl.includes('legendary') && tl.includes('creature');
  });

  // ─── RENDER ───

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Toasts */}
      {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}

      {/* ═══ HEADER ═══ */}
      <header style={sx.header}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--accent)', fontWeight: 700, letterSpacing: '-0.02em' }}>cEDHcube</h1>
        <select value={theme} onChange={e => setTheme(e.target.value as any)}
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.35rem 0.6rem', borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer' }}>
          {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </header>

      {/* ═══ TABS ═══ */}
      <div style={{ display: 'flex', paddingLeft: 6, paddingRight: 6, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', gap: 0 }}>
        {(['decks', 'collection'] as const).map(t => (
          <button key={t} onClick={() => switchTab(t)}
            style={{ padding: '0.7rem 1.5rem', background: 'transparent', border: 'none', color: tab === t ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 0.15s' }}>
            {t === 'decks' ? '🃏  Decks' : '📦  Collection'}
          </button>
        ))}
      </div>

      {/* ═══════════════════ D E C K S   T A B ═══════════════════ */}
      {tab === 'decks' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>

          {/* ─── Import ─── */}
          <div style={{ ...sx.card, marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--accent)', fontWeight: 600 }}>Import from Moxfield</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <input type="text" placeholder="https://moxfield.com/decks/..." value={moxUrl} onChange={e => setMoxUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && importMox()} style={sx.input} />
              </div>
              <input type="color" value={moxColor} onChange={e => setMoxColor(e.target.value)} style={{ width: 36, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg)', cursor: 'pointer' }} />
              <button onClick={importMox} disabled={importing} style={sx.btn}>{importing ? 'Importing…' : 'Import'}</button>
            </div>
          </div>

          {/* ─── Create ─── */}
          <div style={{ ...sx.card, marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--accent)', fontWeight: 600 }}>New Deck</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input type="text" placeholder="Deck name" value={deckName} onChange={e => setDeckName(e.target.value)} style={sx.input} />
              </div>
              <input type="color" value={deckColor} onChange={e => setDeckColor(e.target.value)} style={{ width: 36, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--input-bg)', cursor: 'pointer' }} />
            </div>
            <textarea placeholder="4 Lightning Bolt&#10;3x Counterspell&#10;1 Black Lotus (LEA)" value={deckCards} onChange={e => setDeckCards(e.target.value)} style={{ ...sx.input, minHeight: 90, resize: 'vertical', fontFamily: 'monospace', marginBottom: 12 }} />
            <button onClick={createDeck} disabled={creating} style={sx.btn}>{creating ? 'Validating…' : 'Create Deck'}</button>
          </div>

          {/* ─── Deck List ─── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent)', fontWeight: 600 }}>My Decks</h3>
            <button onClick={() => { api.refreshAllImages(); show('Refreshing images…', 'info'); }} style={sx.btnGhost}>↻ Refresh Images</button>
          </div>

          {decksLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}><Spinner /></div>
          ) : decks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No decks yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {decks.map(deck => (
                <div key={deck.id}
                  style={{
                    ...sx.card, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: '1rem', cursor: 'pointer', borderLeft: `4px solid ${deck.color}`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = deck.color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                  onClick={() => openDeck(deck)}
                >
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    {deck.commander_image_url ? (
                      <img src={deck.commander_image_url} alt="" style={{ width: 44, height: 33, objectFit: 'cover', objectPosition: 'top center', borderRadius: 6, border: '2px solid var(--border)', flexShrink: 0 }} loading="lazy" />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 6, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1rem', flexShrink: 0 }}>★</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {deck.name}
                        <ColorIdentity identity={deck.color_identity} />
                      </div>
                      {deck.commander_name && <div style={{ fontSize: '0.7rem', color: 'var(--commander)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>★ {deck.commander_name}</div>}
                      <MiniManaCurve stats={deckStats[deck.id] || null} />
                    </div>
                  </div>
                  {/* Right */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{deck.card_count} cards</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{deck.total_cards} total</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ C O L L E C T I O N   T A B ═══════════════════ */}
      {tab === 'collection' && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', color: 'var(--accent)', fontWeight: 600 }}>Collection</h2>

          {/* Search */}
          <input type="text" placeholder="Search cards…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...sx.input, marginBottom: 12 }} />

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 6, fontWeight: 500 }}>Type</span>
            {['all','creature','instant','sorcery','enchantment','artifact','planeswalker','land'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{
                  padding: '0.25rem 0.6rem', borderRadius: 6, border: `1px solid ${typeFilter === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: typeFilter === t ? 'var(--accent)' : 'transparent',
                  color: typeFilter === t ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer', fontSize: '0.72rem', fontWeight: typeFilter === t ? 600 : 400, transition: 'all 0.15s',
                }}>
                {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Deck filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 6, fontWeight: 500 }}>Decks</span>
            <button onClick={toggleAll}
              style={{
                padding: '0.25rem 0.6rem', borderRadius: 6, border: `1px solid ${allDecksOn ? 'var(--accent)' : 'var(--border)'}`,
                background: allDecksOn ? 'var(--accent)' : 'transparent', color: allDecksOn ? '#fff' : 'var(--text-dim)',
                cursor: 'pointer', fontSize: '0.72rem', transition: 'all 0.15s',
              }}>All</button>
            {decks.map(d => (
              <button key={d.id} onClick={() => toggleDeck(d.id)}
                style={{
                  padding: '0.25rem 0.6rem 0.25rem 0.5rem', borderRadius: 6,
                  border: `1px solid ${enabledDeckIds[d.id] ? d.color : 'var(--border)'}`,
                  borderLeft: `3px solid ${d.color}`,
                  background: enabledDeckIds[d.id] ? `linear-gradient(135deg, ${d.color}33, transparent)` : 'transparent',
                  color: enabledDeckIds[d.id] ? 'var(--text)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.72rem', transition: 'all 0.15s',
                }}>
                {d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filteredCollection.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              {allCollection.length === 0 ? 'No cards yet. Add a deck!' : 'No cards match.'}
            </div>
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12,
            }}>
              {filteredCollection.map(c => (
                <div key={c.scryfall_id || c.card_name}
                  onClick={() => openCardDetail(c)}
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.35)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                >
                  {/* Quantity badge */}
                  <span style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 2,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    color: '#fff', padding: '1px 7px', borderRadius: 6,
                    fontSize: '0.68rem', fontWeight: 600,
                  }}>×{c.total_quantity}</span>

                  {/* Foil badge */}
                  {c.is_foil ? <span style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 2,
                    padding: '1px 5px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700,
                    background: 'linear-gradient(135deg, #b8860b, #ffd700, #daa520)',
                    color: '#1a1a1a', border: '1px solid #b8860b',
                  }}>FOIL</span> : null}

                  {/* Card image */}
                  {c.image_url ? (
                    <div style={{ position: 'relative' }}>
                      <img src={c.image_url} alt={c.card_name} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
                      {c.is_foil ? <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(184,134,11,0.15) 0%, rgba(255,215,0,0.08) 50%, rgba(218,165,32,0.15) 100%)', pointerEvents: 'none' }} /> : null}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 160, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>?</div>
                  )}

                  {/* Card info */}
                  <div style={{ padding: '0.5rem 0.6rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.card_name}</div>
                    
                    {/* Type line + mana cost */}
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.type_line?.split('—')[0]?.trim() || ''}
                    </div>

                    {/* Set + decks */}
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {c.set_code && <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>{c.set_code.toUpperCase()}</span>}
                      {c.set_code && <span>·</span>}
                      <span>{c.deck_count} deck{c.deck_count !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Deck dots + color identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                      {c.decks?.filter(d => enabledDeckNames.has(d.name)).map(d => (
                        <span key={d.name} style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} title={d.name} />
                      ))}
                      {/* Color Identity */}
                      {(() => {
                        try { const ci = JSON.parse(c.color_identity); return Array.isArray(ci) && ci.length > 0 ? ci.map((col: string) => (
                          <span key={col} className={`color-pip color-pip\\:${col}`} title={col}>{({W:'☀️',U:'💧',B:'💀',R:'🔥',G:'🌲',C:'⚪'})[col]||col}</span>
                        )) : <span className="color-pip color-pip\\:C" title="Colorless">⚪</span>; } catch { return null; }
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ D E C K   M O D A L ═══════════════════ */}
      {modalDeck && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '2rem', overflowY: 'auto',
        }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{
            ...sx.card, maxWidth: 720, width: '92%', maxHeight: '85vh', overflowY: 'auto',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', display: 'inline-block', background: modalDeck.color, border: '2px solid rgba(255,255,255,0.25)' }} />
                {modalDeck.name}
              </h2>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={renameDeck} style={sx.btnGhost}>✏️</button>
                <button onClick={deleteDeck} style={{ ...sx.btnGhost, borderColor: 'var(--danger)', color: 'var(--danger)' }}>🗑️</button>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem', padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {/* Color Identity */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>CI</span>
              {modalCI.length === 0 ? <span className="color-pip color-pip\\:C" title="Colorless">⚪</span> : modalCI.map(c => <span key={c} className={`color-pip color-pip\\:${c}`} title={c}>{({W:'☀️',U:'💧',B:'💀',R:'🔥',G:'🌲',C:'⚪'})[c]||c}</span>)}
            </div>

            {/* Mana curve */}
            <FullManaCurve stats={modalStats} />

            {/* Commander */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {modalDeck.commander_image_url ? (
                  <img src={modalDeck.commander_image_url} alt="" style={{ width: 44, height: 'auto', borderRadius: 6, border: '2px solid var(--commander)' }} />
                ) : null}
                <span style={modalDeck.commander_name ? { fontWeight: 600, fontSize: '0.85rem', color: 'var(--commander)' } : { color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                  {modalDeck.commander_name ? `★ ${modalDeck.commander_name}` : 'No commander'}
                </span>
              </div>
              {legendaryCreatures.length > 0 && (
                <>
                  <button onClick={() => setShowCommanderPicker(!showCommanderPicker)} style={{ ...sx.btnGhost, fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: 6 }}>{showCommanderPicker ? 'Cancel' : 'Change'}</button>
                  {showCommanderPicker && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {legendaryCreatures.map(c => (
                        <div key={c.id} onClick={() => setCommander(c.card_name, c.image_url || '')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: 5, borderRadius: 6, cursor: 'pointer',
                            background: c.card_name === modalDeck!.commander_name ? 'var(--commander-bg)' : 'transparent',
                            border: c.card_name === modalDeck!.commander_name ? '1px solid var(--commander)' : '1px solid transparent',
                            fontSize: '0.8rem',
                          }}>
                          {c.image_url ? <img src={c.image_url} alt="" style={{ width: 24, height: 'auto', borderRadius: 3 }} /> : <div style={{ width: 24, height: 33, background: '#333', borderRadius: 3 }} />}
                          {c.card_name}
                        </div>
                      ))}
                      <div onClick={() => setCommander('', '')} style={{ padding: 5, borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>✕ Clear</div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Card search */}
            <input type="text" placeholder="Search cards…" value={modalSearch} onChange={e => setModalSearch(e.target.value)} style={{ ...sx.input, fontSize: '0.8rem', marginBottom: 10 }} />

            {/* Card list */}
            <div style={{ marginBottom: 12 }}>
              {modalCards.filter(c => !modalSearch || c.card_name.toLowerCase().includes(modalSearch.toLowerCase())).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {c.image_url ? <img src={c.image_url} alt="" style={{ width: 28, height: 'auto', borderRadius: 4, flexShrink: 0 }} /> : <div style={{ width: 28, height: 39, background: '#333', borderRadius: 4, flexShrink: 0 }} />}
                  <div style={{ flex: 1, fontSize: '0.78rem', minWidth: 0 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.card_name}</span>
                    {c.mana_cost && <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{c.mana_cost}</span>}
                  </div>
                  <span onClick={() => { api.updateCard(c.id, { is_foil: c.is_foil ? 0 : 1 }).then(() => loadModal(modalDeck!.id)); }}
                    style={{
                      padding: '1px 5px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
                      background: c.is_foil ? 'linear-gradient(135deg, #b8860b, #ffd700)' : 'var(--border)',
                      color: c.is_foil ? '#1a1a1a' : 'var(--text-dim)',
                    }}>{c.is_foil ? 'FOIL' : 'non'}</span>
                  <input type="number" value={c.quantity} min={1} onChange={e => { api.updateCard(c.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) }); }}
                    style={{ width: 44, padding: '0.2rem 0.3rem', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.75rem', textAlign: 'center' }} />
                  <button onClick={() => { api.deleteCard(c.id).then(() => loadModal(modalDeck!.id)); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', padding: 2 }}>✕</button>
                </div>
              ))}
            </div>

            {/* Add cards */}
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <textarea placeholder="Paste cards…" value={addCardsText} onChange={e => setAddCardsText(e.target.value)} style={{ ...sx.input, minHeight: 60, fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: 8 }} />
              <button onClick={addCards} disabled={addCardsLoading} style={sx.btn}>{addCardsLoading ? 'Validating…' : 'Add Cards'}</button>
              {addCardsResults.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {addCardsResults.map((r, i) => (
                    <div key={i} style={{ padding: 4, borderRadius: 4, marginBottom: 3, fontSize: '0.75rem', background: r.status === 'ok' ? 'var(--success-bg)' : 'var(--error-bg)' }}>
                      {r.requested} ×{r.quantity} — {r.status === 'ok' ? `✅ ${r.resolved}` : '❌ Not found'}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{modalDeck.card_count} cards</span>
              <button onClick={closeModal} style={sx.btnGhost}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ C A R D   D E T A I L   M O D A L ═══════════════════ */}
      {detailCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '2rem', overflowY: 'auto',
        }} onClick={e => { if (e.target === e.currentTarget) closeCardDetail(); }}>
          <div style={{
            ...sx.card, maxWidth: 780, width: '92%', maxHeight: '85vh', overflowY: 'auto',
            animation: 'fadeIn 0.2s ease-out',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--accent)' }}>{cardDetail?.name_en || detailCard.card_name}</h2>
                {detailCard.type_line && <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>{detailCard.type_line}</div>}
              </div>
              <button onClick={closeCardDetail} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.3rem', padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {/* Card image */}
              <div style={{ flexShrink: 0, width: 220, maxWidth: '100%' }}>
                {detailCard.image_url ? (
                  <img src={detailCard.image_url} alt={detailCard.card_name} style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid var(--border)' }} />
                ) : <div style={{ width: '100%', height: 300, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No image</div>}
              </div>

              {/* Info column */}
              <div style={{ flex: 1, minWidth: 260 }}>
                {cardDetailLoading ? (
                  <div style={{ padding: '2rem 0', textAlign: 'center' }}><Spinner /></div>
                ) : cardDetail ? (
                  <>
                    {/* Localized names */}
                    <div style={{ marginBottom: 14 }}>
                      {([['English', cardDetail.name_en], ['Deutsch', cardDetail.name_de], ['日本語', cardDetail.name_ja]] as const).map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ width: 76, flexShrink: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>{value || '—'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Decks included */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Included in {detailCard.deck_count} deck{detailCard.deck_count !== 1 ? 's' : ''}</div>
                      {detailCard.decks && detailCard.decks.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {detailCard.decks.map(d => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem' }}>
                              <span style={{ width: 11, height: 11, borderRadius: '50%', background: d.color, border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                              {d.name}
                            </div>
                          ))}
                        </div>
                      ) : <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not currently in any deck.</div>}
                    </div>

                    {/* Oracle text */}
                    {cardDetail.oracle_text ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text)', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', whiteSpace: 'pre-wrap' }}>
                        {cardDetail.oracle_text}
                      </div>
                    ) : null}
                  </>
                ) : <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Could not load card details.</div>}
              </div>
            </div>

            {/* Rulings */}
            <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
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