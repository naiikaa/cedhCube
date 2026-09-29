import { useEffect, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { CollectionValue } from './Price';
import type { PriceSummary } from '../lib/types';

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = THEMES.find(t => t.value === theme) ?? THEMES[0];

  return (
    <div className="theme-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="theme-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change theme"
        title="Change theme"
        onClick={() => setOpen(o => !o)}
      >
        Theme ▸ {current.label}
      </button>
      {open && (
        <div className="theme-menu slide-down" role="menu">
          {THEMES.map(t => (
            <button
              key={t.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === t.value}
              className="theme-option"
              onClick={() => { setTheme(t.value); setOpen(false); }}
            >
              <span className="theme-swatch" aria-hidden="true">
                {t.swatch.map(c => <i key={c} style={{ background: c }} />)}
              </span>
              {t.label}
              {theme === t.value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface HeaderProps {
  deckCount: number;
  uniqueCards: number;
  totalCards: number;
  /** Paper value of the whole collection; null until the summary loads. */
  priceSummary: PriceSummary | null;
  /** Jumps to the Collection tab with the query pre-filled. */
  onSearch: (query: string) => void;
}

export function Header({ deckCount, uniqueCards, totalCards, priceSummary, onSearch }: HeaderProps) {
  const [query, setQuery] = useState('');

  const stats: [number, string][] = [
    [deckCount, deckCount === 1 ? 'Deck' : 'Decks'],
    [uniqueCards, 'Unique'],
    [totalCards, 'Cards'],
  ];

  return (
    <header className="app-header">
      <h1 className="wordmark">c<b>EDH</b>cube <span className="wordmark-suffix">// collector's ledger</span></h1>

      <div className="mast-stats">
        {stats.map(([value, label]) => (
          <div key={label} className="mast-stat">
            <span className="mast-stat-value">{value.toLocaleString()}</span>
            <span className="mast-label">{label}</span>
          </div>
        ))}
        <CollectionValue summary={priceSummary} />
      </div>

      <div className="header-tools">
        <form
          className="search-wrap"
          onSubmit={e => { e.preventDefault(); onSearch(query); }}
          role="search"
        >
          <Search aria-hidden="true" />
          <input
            type="search"
            className="field"
            placeholder="Search collection…"
            aria-label="Search collection"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSearch(query); } }}
          />
        </form>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
