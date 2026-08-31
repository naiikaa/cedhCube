import { MANA_COLOR_NAMES, isDrawableManaToken, manaGlyph, tokenizeManaCost } from '../lib/mana';

/**
 * Authentic MTG mana symbols, rendered with the `mana-font` icon font.
 *
 * Mana pips keep their canonical WUBRG colours across every theme — that is
 * how they appear on every printed card and in every official product, so they
 * are intentionally not tinted by the theme custom properties.
 */

export interface ManaPipProps {
  /** A mana token: `W`, `U`, `2`, `X`, `U/B`, `W/P`, `T`, … */
  symbol: string;
  /** Skip the round pip background (used for inline decorative glyph rows). */
  bare?: boolean;
  className?: string;
}

export function ManaPip({ symbol, bare = false, className = '' }: ManaPipProps) {
  const label = MANA_COLOR_NAMES[symbol.toUpperCase()] || symbol;
  return (
    <i
      role="img"
      aria-label={label}
      title={label}
      className={`ms ms-${manaGlyph(symbol)}${bare ? '' : ' ms-cost'}${className ? ` ${className}` : ''}`}
    />
  );
}

export interface ManaCostProps {
  /** Scryfall mana cost string, e.g. `{1}{W}{U}`. */
  cost?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

/** Renders a full mana cost as a row of pips. */
export function ManaCost({ cost, size = 'sm' }: ManaCostProps) {
  if (!cost) return null;
  const tokens = tokenizeManaCost(cost);
  if (tokens.length === 0) return null;
  return (
    <span className={`pips ${size === 'md' ? '' : size}`}>
      {tokens.map((t, i) => <ManaPip key={`${t}-${i}`} symbol={t} />)}
    </span>
  );
}

/** Oracle text with `{T}`, `{C}`, `{2}` … replaced by real mana symbols. */
export function OracleText({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!part.startsWith('{') || !part.endsWith('}')) return part;
        const token = part.slice(1, -1);
        if (!isDrawableManaToken(token)) return part;
        return <ManaPip key={i} symbol={token} className="mana-pip-inline" />;
      })}
    </>
  );
}
