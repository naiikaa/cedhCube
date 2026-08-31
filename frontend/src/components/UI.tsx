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
