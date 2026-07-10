export function ColorIdentity({ identity }: { identity: string }) {
  let colors: string[];
  try {
    colors = JSON.parse(identity);
  } catch {
    colors = [];
  }
  if (!Array.isArray(colors) || colors.length === 0) {
    return <span className="color-pip color-pip\:C" title="Colorless" />;
  }
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {colors.map(c => (
        <span key={c} className={`color-pip color-pip\\:${c}`} title={c} />
      ))}
    </span>
  );
}

export const MANA_COLORS: Record<number, string> = {
  0: '#cac5c0', 1: '#f9faf4', 2: '#0e68ab',
  3: '#150b00', 4: '#d3202a', 5: '#00733e', 6: '#a88c5e',
};