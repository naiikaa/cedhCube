/**
 * Pure helpers for translating Scryfall mana notation into `mana-font` classes.
 * Kept out of the component file so the presentational module exports components only.
 */

export const MANA_COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
  C: 'Colorless',
  S: 'Snow',
  X: 'Variable',
  E: 'Energy',
  P: 'Phyrexian',
  T: 'Tap',
  Q: 'Untap',
};

/** `{2}{U/B}{T}` -> `['2', 'U/B', 'T']`. Bare `WUBRG` strings also parse. */
export function tokenizeManaCost(cost: string): string[] {
  const braced = cost.match(/\{[^}]+\}/g);
  if (braced) return braced.map(t => t.slice(1, -1));
  return cost.replace(/\s+/g, '').split('').filter(Boolean);
}

/** Mana-font class suffix for a Scryfall mana token (`U/B` -> `ub`, `T` -> `tap`). */
export function manaGlyph(token: string): string {
  const t = token.toLowerCase().replace(/\//g, '');
  if (t === 't') return 'tap';
  if (t === 'q') return 'untap';
  if (t === '∞') return 'infinity';
  if (t === '½') return 'half';
  return t;
}

/**
 * Tokens mana-font can draw as a pip. Anything else (`{PW}`, `{HALF}`, set
 * codes, …) should stay literal text rather than render as a blank circle.
 */
const DRAWABLE_TOKEN = /^(?:\d+|[WUBRGCSXYZEPTQ]|[WUBRGC2]\/[WUBRGCP]|∞|½)$/i;

export function isDrawableManaToken(token: string): boolean {
  return DRAWABLE_TOKEN.test(token);
}

/** Parses the API's JSON-encoded `color_identity` column into a symbol array. */
export function parseColorIdentity(identity: string | string[] | null | undefined): string[] {
  if (Array.isArray(identity)) return identity;
  if (!identity) return [];
  try {
    const parsed = JSON.parse(identity);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
