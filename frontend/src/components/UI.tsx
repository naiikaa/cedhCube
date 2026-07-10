export function Spinner({ size = 16, inline = false }: { size?: number; inline?: boolean }) {
  const spinner = (
    <div className="animate-spin" style={{
      width: size, height: size,
      border: `2px solid var(--border)`,
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
    }} />
  );
  if (inline) return spinner;
  return <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 8 }}>{spinner}</div>;
}

export function CardImage({ url, name, size = 40, style }: { url?: string | null; name: string; size?: number; style?: React.CSSProperties }) {
  if (!url) {
    return (
      <div style={{
        width: size, height: Math.round(size * 1.4), background: '#333',
        borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#666', fontSize: '0.7rem', ...style,
      }}>
        ?
      </div>
    );
  }
  return <img src={url} alt={name} style={{ width: size, height: 'auto', borderRadius: 4, flexShrink: 0, ...style }} loading="lazy" />;
}