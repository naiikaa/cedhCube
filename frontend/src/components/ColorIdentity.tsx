const SYMBOLS: Record<string, string> = {
  W: '☀️',  // White → sun
  U: '💧',  // Blue → waterdrop
  B: '💀',  // Black → skull
  R: '🔥',  // Red → fire
  G: '🌲',  // Green → tree
  C: '⚪',  // Colorless → white sphere
};

export function ColorIdentity({ identity }: { identity: string }) {
  let colors: string[];
  try {
    colors = JSON.parse(identity);
  } catch {
    colors = [];
  }
  if (!Array.isArray(colors) || colors.length === 0) {
    return <span className="color-pip color-pip\:C" title="Colorless">{SYMBOLS.C}</span>;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {colors.map(c => (
        <span key={c} className={`color-pip color-pip\\:${c}`} title={c}>{SYMBOLS[c] || c}</span>
      ))}
    </span>
  );
}