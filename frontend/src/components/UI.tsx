import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff } from 'lucide-react';

export function Spinner({ size = 16, inline = false }: { size?: number; inline?: boolean }) {
  const spinner = (
    <div className="spin" style={{
      width: size, height: size,
      border: '2px solid var(--border)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
    }} />
  );
  if (inline) return spinner;
  return <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{spinner}</div>;
}

export function CardImage({ url, name, size = 40, style }: { url?: string | null; name: string; size?: number; style?: React.CSSProperties }) {
  if (!url) {
    return (
      <div style={{
        width: size, height: Math.round(size * 1.4), flexShrink: 0,
        background: 'var(--bg-surface-hover)', border: '1px solid var(--border)',
        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', ...style,
      }}>
        <ImageOff size={Math.max(10, Math.round(size * 0.4))} aria-label={`No image for ${name}`} />
      </div>
    );
  }
  return <img src={url} alt={name} style={{ width: size, height: 'auto', borderRadius: 4, flexShrink: 0, display: 'block', ...style }} loading="lazy" />;
}

/** Swap any Scryfall image size for `large` so hover previews show the whole card. */
export const previewUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/(art_crop|normal)\//, '/large/');
};

/** Normalise any Scryfall card-frame image to its `art_crop` cutout for row thumbs. */
export const cropUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/(normal|large|small|png)\//, '/art_crop/');
};

/** Hover a small thumb → enlarge the full card next to it (portal'd so scroll can't clip it). */
export function CardZoom({ url, name, children }: { url: string; name: string; children: ReactNode }) {
  const [pop, setPop] = useState<{ left: number; top: number } | null>(null);
  const large = previewUrl(url);
  if (!large) return <>{children}</>;
  const POP_W = 230;
  return (
    <span
      className="card-zoom"
      onMouseEnter={e => {
        const r = e.currentTarget.getBoundingClientRect();
        const placeLeft = r.right + POP_W + 16 > window.innerWidth;
        setPop({ left: placeLeft ? r.left - POP_W - 8 : r.right + 8, top: r.top });
      }}
      onMouseLeave={() => setPop(null)}
    >
      {children}
      {pop && createPortal(
        <img
          className="card-zoom-pop"
          src={large}
          alt={name}
          style={{ left: pop.left, top: pop.top }}
        />,
        document.body,
      )}
    </span>
  );
}
