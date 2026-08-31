import { Fragment, useEffect, useRef, useState } from 'react';
import { Check, Palette, Search } from 'lucide-react';
import { useTheme, THEMES } from '../hooks/useTheme';
import { ManaPip } from './ManaPip';

/** Decorative watermark glyphs — repeated WUBRG cluster behind the header. */
const WATERMARK = Array.from({ length: 40 }, (_, i) => ['w', 'u', 'b', 'r', 'g'][i % 5]);

const BRAND_PIPS = ['W', 'U', 'B', 'R', 'G'];

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

  return (
    <div className="theme-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Change theme"
        title="Change theme"
        onClick={() => setOpen(o => !o)}
      >
        <Palette />
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
  /** Jumps to the Collection tab with the query pre-filled. */
  onSearch: (query: string) => void;
}

export function Header({ deckCount, uniqueCards, totalCards, onSearch }: HeaderProps) {
  const [query, setQuery] = useState('');

  const stats: [number, string][] = [
    [deckCount, deckCount === 1 ? 'Deck' : 'Decks'],
    [uniqueCards, 'Unique'],
    [totalCards, 'Cards'],
  ];

  return (
    <header className="app-header">
      <div className="header-watermark" aria-hidden="true">
        {WATERMARK.map((c, i) => <i key={i} className={`ms ms-${c}`} />)}
      </div>

      <div className="header-brand">
        <h1 className="wordmark">c<b>EDH</b>cube</h1>
        <span className="brand-pips" aria-hidden="true">
          {BRAND_PIPS.map(c => <ManaPip key={c} symbol={c} />)}
        </span>
      </div>

      <div className="header-stats">
        {stats.map(([value, label], i) => (
          <Fragment key={label}>
            {i > 0 && <span className="stat-sep" aria-hidden="true" />}
            <div className="stat">
              <span className="stat-value">{value.toLocaleString()}</span>
              <span className="stat-label">{label}</span>
            </div>
          </Fragment>
        ))}
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
            style={{ width: 'clamp(140px, 22vw, 240px)', fontSize: '0.8rem' }}
          />
        </form>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
