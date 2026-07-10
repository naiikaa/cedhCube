import { useState, useEffect, useCallback } from 'react';
import { useTheme, THEMES } from './hooks/useTheme';
import { api } from './lib/api';
import type { Deck, Card, CollectionCard, CardResult, CmcStats } from './lib/types';
import { ColorIdentity } from './components/ColorIdentity';
import { MiniManaCurve, FullManaCurve } from './components/ManaCurve';
import { Spinner, CardImage } from './components/UI';
import { useToast, Toast } from './components/Toast';

type Tab = 'decks' | 'collection';

function App() {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('decks');
  const { show, toasts, remove } = useToast();

  // Decks state
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [deckStats, setDeckStats] = useState<Record<number, CmcStats>>({});

  // Modal state
  const [modalDeck, setModalDeck] = useState<Deck | null>(null);
  const [modalCards, setModalCards] = useState<Card[]>([]);
  const [modalStats, setModalStats] = useState<CmcStats | null>(null);
  const [modalColorIdentity, setModalColorIdentity] = useState<string[]>([]);
  const [modalCardSearch, setModalCardSearch] = useState('');
  const [addCardsText, setAddCardsText] = useState('');
  const [addCardsLoading, setAddCardsLoading] = useState(false);
  const [addCardsResults, setAddCardsResults] = useState<CardResult[]>([]);

  // Collection state
  const [allCollection, setAllCollection] = useState<CollectionCard[]>([]);
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [enabledDeckIds, setEnabledDeckIds] = useState<Record<number, boolean>>({});

  // Add deck form
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckCards, setNewDeckCards] = useState('');
  const [newDeckColor, setNewDeckColor] = useState('#e94560');
  const [creatingDeck, setCreatingDeck] = useState(false);

  // Moxfield import
  const [moxfieldUrl, setMoxfieldUrl] = useState('');
  const [moxfieldColor, setMoxfieldColor] = useState('#e94560');
  const [importing, setImporting] = useState(false);

  const loadDecks = useCallback(() => {
    setDecksLoading(true);
    api.getDecks()
      .then(d => {
        setDecks(d);
        setDecksLoading(false);
        // Load stats for each deck
        d.forEach(deck => {
          api.getDeckStats(deck.id).then(s => {
            setDeckStats(prev => ({ ...prev, [deck.id]: s }));
          }).catch(() => {});
        });
      })
      .catch(e => { show(e.message, 'error'); setDecksLoading(false); });
  }, [show]);

  const loadCollection = useCallback(() => {
    api.getCollection()
      .then(cards => { setAllCollection(cards); })
      .catch(e => show(e.message, 'error'));

    api.getDecks().then(d => {
      setDecks(d);
      setEnabledDeckIds(prev => {
        const next = { ...prev };
        d.forEach(dd => { if (next[dd.id] === undefined) next[dd.id] = true; });
        return next;
      });
    }).catch(() => {});
  }, [show]);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === 'collection') loadCollection();
  };

  // --- Deck CRUD ---
  const createDeck = async () => {
    if (!newDeckName.trim()) { show('Deck name required', 'error'); return; }
    if (!newDeckCards.trim()) { show('Paste at least one card', 'error'); return; }
    setCreatingDeck(true);
    try {
      const res = await api.createDeck(newDeckName.trim(), newDeckCards.trim(), newDeckColor);
      show(`"${res.name}" created with ${res.results.length} cards`, 'success');
      setNewDeckName(''); setNewDeckCards(''); setNewDeckColor('#e94560');
      loadDecks();
    } catch (e: any) {
      show(e.message, 'error');
    } finally { setCreatingDeck(false); }
  };

  const importMoxfield = async () => {
    if (!moxfieldUrl.trim()) { show('Enter a Moxfield URL', 'error'); return; }
    setImporting(true);
    try {
      const res = await api.importMoxfield(moxfieldUrl.trim(), moxfieldColor);
      show(`"${res.name}" imported (${res.results.length} cards)`, 'success');
      setMoxfieldUrl('');
      loadDecks();
      // Poll for images
      setTimeout(() => pollDeckImages(res.id), 2000);
    } catch (e: any) {
      show(e.message, 'error');
    } finally { setImporting(false); }
  };

  const pollDeckImages = (deckId: number, attempts = 0) => {
    if (attempts >= 5) return;
    api.getDeckCards(deckId).then(cards => {
      const missing = cards.filter(c => !c.image_url).length;
      if (missing > 0 && attempts < 5) {
        setTimeout(() => pollDeckImages(deckId, attempts + 1), 2000);
      }
      loadDecks();
      if (modalDeck?.id === deckId) loadModalCards(deckId);
    }).catch(() => {});
  };

  const openDeck = async (deck: Deck) => {
    setModalDeck(deck);
    loadModalCards(deck.id);
    try {
      const [stats, ci] = await Promise.all([
        api.getDeckStats(deck.id),
        api.getDeckColorIdentity(deck.id),
      ]);
      setModalStats(stats);
      setModalColorIdentity(ci.color_identity);
    } catch {}
  };

  const loadModalCards = async (deckId: number) => {
    try {
      const cards = await api.getDeckCards(deckId);
      setModalCards(cards);
    } catch {}
  };

  const closeModal = () => {
    setModalDeck(null);
    setModalCards([]);
    setModalCardSearch('');
    setAddCardsText('');
    setAddCardsResults([]);
    loadDecks();
  };

  const deleteCurrentDeck = async () => {
    if (!modalDeck) return;
    if (!window.confirm(`Delete deck "${modalDeck.name}" and all its cards?`)) return;
    try {
      await api.deleteDeck(modalDeck.id);
      show('Deck deleted', 'info');
      closeModal();
    } catch (e: any) { show(e.message, 'error'); }
  };

  const renameDeck = async () => {
    if (!modalDeck) return;
    const name = window.prompt('New deck name:', modalDeck.name);
    if (!name?.trim()) return;
    try {
      await api.renameDeck(modalDeck.id, name.trim());
      setModalDeck({ ...modalDeck, name: name.trim() });
      loadDecks();
    } catch (e: any) { show(e.message, 'error'); }
  };

  const updateDeckColor = async (deckId: number, color: string) => {
    try {
      await api.updateDeckColor(deckId, color);
      setModalDeck(prev => prev && prev.id === deckId ? { ...prev, color } : prev);
      loadDecks();
    } catch (e: any) { show(e.message, 'error'); }
  };

  const updateCardQty = async (cardId: number, qty: number) => {
    try { await api.updateCard(cardId, { quantity: Math.max(1, qty) }); } catch {}
  };

  const toggleFoil = async (card: Card) => {
    try {
      await api.updateCard(card.id, { is_foil: card.is_foil ? 0 : 1 });
      setModalCards(prev => prev.map(c => c.id === card.id ? { ...c, is_foil: c.is_foil ? 0 : 1 } : c));
    } catch {}
  };

  const removeCard = async (cardId: number) => {
    try {
      await api.deleteCard(cardId);
      loadModalCards(modalDeck!.id);
    } catch {}
  };

  const addMoreCards = async () => {
    if (!addCardsText.trim() || !modalDeck) return;
    setAddCardsLoading(true);
    setAddCardsResults([]);
    try {
      const res = await api.addCards(modalDeck.id, addCardsText.trim());
      setAddCardsResults(res.results);
      setAddCardsText('');
      loadModalCards(modalDeck.id);
    } catch (e: any) {
      show(e.message, 'error');
    } finally { setAddCardsLoading(false); }
  };

  const selectCommander = async (name: string, imageUrl: string) => {
    if (!modalDeck) return;
    try {
      await api.updateDeckCommander(modalDeck.id, name, imageUrl);
      setModalDeck({ ...modalDeck, commander_name: name, commander_image_url: imageUrl });
      show(`Commander set to ${name || 'none'}`, 'success');
      loadDecks();
    } catch {}
  };

  // --- Collection filtering ---
  const filteredCollection = allCollection.filter(c => {
    // Deck filter
    const enabledIds = Object.keys(enabledDeckIds).filter(id => enabledDeckIds[Number(id)]);
    if (enabledIds.length < Object.keys(enabledDeckIds).length && enabledIds.length > 0) {
      const hasDeck = c.decks?.some(d => {
        const deck = decks.find(dd => dd.name === d.name);
        return deck && enabledDeckIds[deck.id];
      });
      if (!hasDeck) return false;
    } else if (enabledIds.length === 0) return false;

    // Type filter
    if (collectionFilter !== 'all') {
      const tl = (c.type_line || '').toLowerCase();
      if (!tl.includes(collectionFilter)) return false;
    }

    // Search
    if (collectionSearch) {
      if (!c.card_name.toLowerCase().includes(collectionSearch.toLowerCase())) return false;
    }

    return true;
  });

  const toggleDeckFilter = (deckId: number) => {
    setEnabledDeckIds(prev => ({ ...prev, [deckId]: !prev[deckId] }));
  };

  const toggleAllDecks = () => {
    const allOn = decks.every(d => enabledDeckIds[d.id]);
    const newState = !allOn;
    setEnabledDeckIds(prev => {
      const next = { ...prev };
      decks.forEach(d => { next[d.id] = newState; });
      return next;
    });
  };

  const allDecksOn = decks.every(d => enabledDeckIds[d.id]);

  // Commander picker
  const legendaryCreatures = modalCards.filter(c => {
    const tl = (c.type_line || '').toLowerCase();
    return tl.includes('legendary') && tl.includes('creature');
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
      ))}

      {/* Header */}
      <header style={{
        background: 'var(--bg-surface)', padding: '1rem 2rem',
        borderBottom: '2px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
          ✨ cEDHcube
        </h1>
        <select
          value={theme}
          onChange={e => setTheme(e.target.value as any)}
          style={{
            background: 'var(--input-bg)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '0.4rem 0.6rem', borderRadius: 6,
            fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        {(['decks', 'collection'] as const).map(t => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            style={{
              padding: '0.75rem 1.5rem', background: 'transparent', border: 'none',
              color: tab === t ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer', fontSize: '1rem',
              borderBottom: tab === t ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {t === 'decks' ? '🃏 Decks' : '📦 Collection'}
          </button>
        ))}
      </div>

      {/* Decks Tab */}
      {tab === 'decks' && (
        <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
          {/* Moxfield Import */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ color: 'var(--accent)', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📥 Import from Moxfield</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Deck URL</label>
                <input
                  type="text"
                  placeholder="https://www.moxfield.com/decks/..."
                  value={moxfieldUrl}
                  onChange={e => setMoxfieldUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && importMoxfield()}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: '0 0 auto', minWidth: 'auto' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Color</label>
                <input
                  type="color"
                  value={moxfieldColor}
                  onChange={e => setMoxfieldColor(e.target.value)}
                  style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--input-bg)', cursor: 'pointer' }}
                />
              </div>
              <button onClick={importMoxfield} disabled={importing} style={btnStyle}>
                {importing ? <>Importing... <Spinner inline /></> : '📥 Import Deck'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>or create manually</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Add Deck Form */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem',
          }}>
            <h3 style={{ color: 'var(--accent)', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>➕ Add New Deck</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Deck Name</label>
                <input
                  type="text"
                  placeholder="Enter deck name..."
                  value={newDeckName}
                  onChange={e => setNewDeckName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Color</label>
                <input
                  type="color"
                  value={newDeckColor}
                  onChange={e => setNewDeckColor(e.target.value)}
                  style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--input-bg)', cursor: 'pointer' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 4 }}>Card List</label>
              <textarea
                placeholder="4 Lightning Bolt&#10;3x Counterspell&#10;1 Black Lotus (LEA)"
                value={newDeckCards}
                onChange={e => setNewDeckCards(e.target.value)}
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontFamily: 'monospace' }}
              />
            </div>
            <button onClick={createDeck} disabled={creatingDeck} style={btnStyle}>
              {creatingDeck ? <>Validating... <Spinner inline /></> : 'Create Deck & Validate Cards'}
            </button>
          </div>

          {/* Deck List */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--accent)', margin: 0, fontSize: '1.1rem' }}>🃏 My Decks</h3>
            <button
              onClick={() => {
                api.refreshAllImages().then(() => show('Refreshing images...', 'info'));
              }}
              style={{ ...btnStyle, background: 'var(--border)' }}
            >
              🔄 Refresh All Images
            </button>
          </div>

          {decksLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><Spinner /></div>
          ) : decks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No decks yet. Create one above!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {decks.map(deck => (
                <div
                  key={deck.id}
                  className="animate-fade-in"
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '1rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    {deck.commander_image_url ? (
                      <img src={deck.commander_image_url} alt="Cmd" className="cmd-thumb" />
                    ) : (
                      <div className="cmd-placeholder">★</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', background: deck.color, flexShrink: 0 }} />
                        {deck.name}
                        <ColorIdentity identity={deck.color_identity} />
                      </div>
                      {deck.commander_name && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--commander)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ★ {deck.commander_name}
                        </div>
                      )}
                      <MiniManaCurve stats={deckStats[deck.id] || null} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {deck.card_count} unique · {deck.total_cards} total
                  </div>
                  <button onClick={() => openDeck(deck)} style={{ ...btnStyle, background: 'var(--border)' }}>
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collection Tab */}
      {tab === 'collection' && (
        <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ color: 'var(--accent)', margin: '0 0 1rem 0', fontSize: '1.25rem' }}>📦 Full Collection</h2>

          <input
            type="text"
            placeholder="Search cards by name..."
            value={collectionSearch}
            onChange={e => setCollectionSearch(e.target.value)}
            style={{ ...inputStyle, marginBottom: '0.75rem' }}
          />

          {/* Type Filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: 4 }}>Type:</span>
            {['all', 'creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land'].map(type => (
              <button
                key={type}
                onClick={() => setCollectionFilter(type)}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: 6, border: `1px solid ${collectionFilter === type ? 'var(--accent)' : 'var(--border)'}`,
                  background: collectionFilter === type ? 'var(--accent)' : 'var(--bg-surface)',
                  color: collectionFilter === type ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s',
                }}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Deck Filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: 4 }}>Decks:</span>
            <button
              onClick={toggleAllDecks}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: 6,
                border: `1px solid ${allDecksOn ? 'var(--accent)' : 'var(--border)'}`,
                background: allDecksOn ? 'var(--accent)' : 'var(--bg-surface)',
                color: allDecksOn ? '#fff' : 'var(--text-dim)',
                cursor: 'pointer', fontSize: '0.75rem',
              }}
            >
              All
            </button>
            {decks.map(d => (
              <button
                key={d.id}
                onClick={() => toggleDeckFilter(d.id)}
                style={{
                  padding: '0.3rem 0.7rem', borderRadius: 6,
                  borderTop: `1px solid ${enabledDeckIds[d.id] ? d.color : 'var(--border)'}`,
                  borderRight: `1px solid ${enabledDeckIds[d.id] ? d.color : 'var(--border)'}`,
                  borderBottom: `1px solid ${enabledDeckIds[d.id] ? d.color : 'var(--border)'}`,
                  borderLeft: `3px solid ${d.color}`,
                  background: enabledDeckIds[d.id] ? `linear-gradient(135deg, ${d.color}44, ${d.color}22)` : 'var(--bg-surface)',
                  borderLeft: `3px solid ${d.color}`,
                  color: enabledDeckIds[d.id] ? 'var(--text)' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.75rem',
                  transition: 'all 0.2s',
                }}
                title={d.name}
              >
                {d.name}
              </button>
            ))}
          </div>

          {/* Collection Grid */}
          {filteredCollection.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {allCollection.length === 0 ? 'No cards in collection yet. Add a deck first!' : 'No cards match your filters.'}
            </div>
          ) : (
            <div className="card-grid">
              {filteredCollection.map(c => (
                <div
                  key={c.scryfall_id || c.card_name}
                  className="animate-fade-in"
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 8, overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s',
                    position: 'relative',
                  }}
                >
                  {c.image_url ? (
                    <div style={{ position: 'relative' }}>
                      <img src={c.image_url} alt={c.card_name} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
                      {c.is_foil ? <div className="foil-shimmer" style={{ position: 'absolute', inset: 0 }} /> : null}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: 200, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No image
                    </div>
                  )}
                  {c.is_foil ? (
                    <span style={{
                      position: 'absolute', top: 4, right: 4, zIndex: 2,
                      padding: '0.1rem 0.35rem', borderRadius: 4,
                      fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.5px',
                      background: 'linear-gradient(135deg, #b8860b, #ffd700, #daa520)',
                      color: '#1a1a1a', border: '1px solid #b8860b',
                    }}>
                      FOIL
                    </span>
                  ) : null}
                  <div style={{ padding: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.card_name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                      {c.set_code?.toUpperCase()} · in {c.deck_count} deck(s)
                    </div>
                    {c.decks?.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                        {c.decks.map(d => (
                          <span key={d.name} style={{ width: 12, height: 12, borderRadius: '50%', background: d.color, border: '1px solid rgba(255,255,255,0.3)' }} title={d.name} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{
                    position: 'absolute', top: 4, left: 4, zIndex: 2,
                    background: 'var(--accent)', color: '#fff',
                    padding: '0.1rem 0.4rem', borderRadius: 4,
                    fontSize: '0.7rem',
                  }}>
                    x{c.total_quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deck Modal */}
      {modalDeck && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '3rem',
          }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          onKeyDown={e => { if (e.key === 'Escape') closeModal(); }}
        >
          <div className="animate-fade-in" style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '2rem', maxWidth: 800, width: '90%',
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'inline-block', background: modalDeck.color, border: '2px solid rgba(255,255,255,0.3)' }} />
                {modalDeck.name}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const color = window.prompt('Deck color hex:', modalDeck.color);
                  if (color) updateDeckColor(modalDeck.id, color.trim());
                }} style={{ ...btnStyle, background: 'var(--border)', padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>🎨 Color</button>
                <button onClick={renameDeck} style={{ ...btnStyle, background: 'var(--border)', padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>✏️ Rename</button>
                <button onClick={deleteCurrentDeck} style={{ ...btnStyle, background: 'var(--danger)', padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}>🗑️ Delete</button>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.5rem', padding: 0 }}>✕</button>
              </div>
            </div>

            {/* Color Identity */}
            {modalColorIdentity.length > 0 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: 4 }}>Color Identity:</span>
                {modalColorIdentity.length === 0 ? (
                  <span className="color-pip color-pip\:C" title="Colorless" />
                ) : modalColorIdentity.map(c => (
                  <span key={c} className={`color-pip color-pip\\:${c}`} title={c} />
                ))}
              </div>
            )}

            {/* Mana Curve */}
            <FullManaCurve stats={modalStats} />

            {/* Commander */}
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {modalDeck.commander_image_url ? (
                  <img src={modalDeck.commander_image_url} alt="Commander" style={{ width: 60, height: 'auto', borderRadius: 4, border: '2px solid var(--commander)' }} />
                ) : null}
                <span style={modalDeck.commander_name ? { fontWeight: 600, color: 'var(--commander)' } : { color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {modalDeck.commander_name ? `★ ${modalDeck.commander_name}` : 'No commander set'}
                </span>
              </div>
              {legendaryCreatures.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      const picker = document.getElementById('commander-picker');
                      if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
                    }}
                    style={{ ...btnStyle, background: 'var(--border)', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    Change Commander
                  </button>
                  <div id="commander-picker" style={{ display: 'none', marginTop: 8 }}>
                    {legendaryCreatures.map(c => (
                      <div
                        key={c.id}
                        onClick={() => selectCommander(c.card_name, c.image_url || '')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 4,
                          cursor: 'pointer', border: c.card_name === modalDeck.commander_name ? '1px solid var(--commander)' : '1px solid transparent',
                          background: c.card_name === modalDeck.commander_name ? 'var(--commander-bg)' : 'transparent',
                        }}
                      >
                        <CardImage url={c.image_url} name={c.card_name} size={32} />
                        <span style={{ fontSize: '0.8rem' }}>{c.card_name}</span>
                      </div>
                    ))}
                    <div
                      onClick={() => selectCommander('', '')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>✕ Clear commander</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Deck Card Search */}
            <input
              type="text"
              placeholder="Search cards in this deck..."
              value={modalCardSearch}
              onChange={e => setModalCardSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: '1rem' }}
            />

            {/* Cards */}
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#888' }}>Cards in deck</h4>
              {modalCards.filter(c => !modalCardSearch || c.card_name.toLowerCase().includes(modalCardSearch.toLowerCase())).map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: 8,
                  borderBottom: '1px solid var(--border)',
                }}>
                  <CardImage url={c.image_url} name={c.card_name} />
                  <div style={{ flex: 1, fontSize: '0.85rem' }}>
                    {c.card_name}
                    {c.set_code ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 4 }}>({c.set_code.toUpperCase()})</span> : null}
                  </div>
                  <span
                    onClick={() => toggleFoil(c)}
                    style={{
                      padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                      cursor: 'pointer', letterSpacing: '0.5px',
                      background: c.is_foil ? 'linear-gradient(135deg, #b8860b, #ffd700, #daa520)' : 'var(--border)',
                      color: c.is_foil ? '#1a1a1a' : 'var(--text-dim)',
                      border: `1px solid ${c.is_foil ? '#b8860b' : 'var(--border-light)'}`,
                    }}
                  >
                    {c.is_foil ? 'FOIL' : 'non-foil'}
                  </span>
                  <input
                    type="number"
                    value={c.quantity}
                    min={1}
                    onChange={e => {
                      const qty = parseInt(e.target.value) || 1;
                      updateCardQty(c.id, qty);
                    }}
                    style={{
                      width: 55, padding: '0.3rem', borderRadius: 4, border: '1px solid var(--border)',
                      background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.8rem',
                      textAlign: 'center',
                    }}
                  />
                  <button onClick={() => removeCard(c.id)} style={{ background: 'var(--danger)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>✕</button>
                </div>
              ))}
            </div>

            {/* Add More Cards */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ color: '#888', margin: '0 0 0.5rem 0' }}>Add more cards</h4>
              <textarea
                placeholder="Paste more cards here..."
                value={addCardsText}
                onChange={e => setAddCardsText(e.target.value)}
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'monospace', marginBottom: 8 }}
              />
              <button onClick={addMoreCards} disabled={addCardsLoading} style={btnStyle}>
                {addCardsLoading ? <>Validating... <Spinner inline /></> : 'Validate & Add'}
              </button>
              {addCardsResults.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {addCardsResults.map((r, i) => (
                    <div key={i} style={{
                      padding: '0.4rem', borderRadius: 4, marginBottom: 4, fontSize: '0.8rem',
                      background: r.status === 'ok' ? 'var(--success-bg)' : 'var(--error-bg)',
                    }}>
                      {r.requested} (x{r.quantity}) — {r.status === 'ok' ? '✅ ' + r.resolved : '❌ Not found'}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '0.8rem' }}>{modalDeck.card_count} cards</span>
              <button onClick={closeModal} style={{ ...btnStyle, background: 'var(--border)' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)', border: '1px solid var(--border)',
  color: 'var(--text)', padding: '0.5rem 0.75rem', borderRadius: 6,
  fontSize: '0.9rem', width: '100%', outline: 'none',
};

const btnStyle: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer',
  fontSize: '0.9rem', transition: 'background 0.2s',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

export default App;