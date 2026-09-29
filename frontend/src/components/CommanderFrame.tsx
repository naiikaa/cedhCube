import type { CSSProperties } from 'react';
import { Crown } from 'lucide-react';
import { parseColorIdentity } from '../lib/mana';
import { cropUrl } from './UI';
import type { CommanderPick } from '../lib/deck';

/** Canonical WUBRG fills for the identity pip — never theme-tinted. */
const MANA_HEX: Record<string, string> = {
  W: '#f8f1d8', U: '#3f8fd8', B: '#5a4a52', R: '#e0543a', G: '#3d9a5a', C: '#b8b0a8',
};

/** Conic slices of the colour identity, so a 3-colour deck shows three wedges. */
function identityFill(identity: string | string[] | null | undefined): string {
  const colors = parseColorIdentity(identity);
  const list = colors.length ? colors : ['C'];
  if (list.length === 1) return MANA_HEX[list[0]] ?? MANA_HEX.C;
  const step = 360 / list.length;
  return `conic-gradient(${list.map((c, i) => `${MANA_HEX[c] ?? MANA_HEX.C} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
}

export interface CommanderFrameProps {
  commanders: CommanderPick[];
  /** Deck colour — drives the ring. Falls back to the commander gold. */
  color?: string;
  /** Colour identity for the pip; omitted → no pip. */
  identity?: string | string[] | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Picker state: ring lights up in the deck colour. */
  active?: boolean;
}

/**
 * The system's chrome signature: commander art seated in a round ring in the
 * deck colour, with a seat shadow and an identity pip. Partners overlap.
 * Used identically on deck rows, the deck modal, the commander picker and the
 * meta tab, so a deck is recognisable wherever it appears.
 */
export function CommanderFrame({ commanders, color, identity, size = 'md', active = false }: CommanderFrameProps) {
  const style = color ? ({ '--deck-color': color } as CSSProperties) : undefined;
  const slots = commanders.length ? commanders : [null];
  return (
    <span className={`cmd-frame ${size}${slots.length > 1 ? ' is-pair' : ''}${active ? ' is-active' : ''}`} style={style}>
      {slots.map((c, i) => (
        <span key={c?.name ?? i} className="cmd-frame-seat" title={c?.name}>
          {c?.image
            ? <img src={cropUrl(c.image)} alt="" loading="lazy" />
            : <Crown aria-hidden="true" />}
        </span>
      ))}
      {identity !== undefined && (
        <span className="cmd-frame-pip" style={{ background: identityFill(identity) }} aria-hidden="true" />
      )}
    </span>
  );
}
