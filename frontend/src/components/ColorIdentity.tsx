import { parseColorIdentity } from '../lib/mana';
import { ManaPip } from './ManaPip';

export interface ColorIdentityProps {
  /** JSON-encoded array from the API (`'["W","U"]'`) or an already-parsed array. */
  identity: string | string[] | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * The single source of truth for colour-identity pips. Empty identity renders
 * the colorless pip, matching how Scryfall/EDHREC present colourless commanders.
 */
export function ColorIdentity({ identity, size = 'md' }: ColorIdentityProps) {
  const colors = parseColorIdentity(identity);
  return (
    <span className={`pips ${size === 'md' ? '' : size}`}>
      {colors.length === 0
        ? <ManaPip symbol="C" />
        : colors.map(c => <ManaPip key={c} symbol={c} />)}
    </span>
  );
}
