import type { CSSProperties } from 'react';
import { parseColorIdentity } from '../lib/mana';
import { cropUrl } from './UI';
import type { CommanderPick } from '../lib/deck';

/** Canonical WUBRG fills for the identity pip — never theme-tinted. */
const MANA_HEX: Record<string, string> = {
  W: '#f8f1d8', U: '#1460aa', B: '#1a1a1a', R: '#d33c22', G: '#2f6b2f', C: '#9a9488',
};

/** Flat hard-stop bands of the colour identity, so a 3-colour deck shows three stripes. */
function identityFill(identity: string | string[] | null | undefined): string {
  const colors = parseColorIdentity(identity);
  const list = colors.length ? colors : ['C'];
  if (list.length === 1) return MANA_HEX[list[0]] ?? MANA_HEX.C;
  const step = 100 / list.length;
  return `linear-gradient(90deg, ${list.map((c, i) => `${MANA_HEX[c] ?? MANA_HEX.C} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

export interface CommanderFrameProps {
  commanders: CommanderPick[];
  /** Deck colour — exposed to the frame as `--deck-color`. */
  color?: string;
  /** Colour identity for the pip; omitted → no pip. */
  identity?: string | string[] | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Picker state: the frame gets the accent outline. */
  active?: boolean;
}

/**
 * Commander art as a hard square block in a 1px ink frame, with an optional
 * identity pip. Partners sit edge to edge. Used on deck rows, the deck modal,
 * the commander picker and the meta tab, so a deck reads the same everywhere.
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
            : <span aria-hidden="true">◆</span>}
        </span>
      ))}
      {identity !== undefined && (
        <span className="cmd-frame-pip" style={{ background: identityFill(identity) }} aria-hidden="true" />
      )}
    </span>
  );
}
