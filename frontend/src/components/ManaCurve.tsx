import type { CmcStats } from '../lib/types';

export function MiniManaCurve({ stats }: { stats: CmcStats | null }) {
  if (!stats?.cmc_bars?.length) return null;
  const maxCount = Math.max(1, ...stats.cmc_bars.map(b => b.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18, marginTop: 4 }}>
      {stats.cmc_bars.map(b => {
        const pct = (b.count / maxCount) * 100;
        const height = Math.max(2, Math.round(pct * 0.16));
        return (
          <div
            key={b.cmc}
            style={{
              width: 6, height, borderRadius: '1px 1px 0 0', minHeight: 2,
              background: 'var(--border)', border: '1px solid var(--border-light)',
            }}
            title={`${b.label || b.cmc}: ${b.count}`}
          />
        );
      })}
    </div>
  );
}

export function FullManaCurve({ stats }: { stats: CmcStats | null }) {
  if (!stats?.cmc_bars?.length) return null;
  const maxCount = Math.max(1, ...stats.cmc_bars.map(b => b.count));
  return (
    <div style={{ margin: '1rem 0' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 8 }}>🔥 Mana Curve</div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 4, height: 80,
        padding: '0 0.5rem', borderBottom: '1px solid var(--border)',
      }}>
        {stats.cmc_bars.map(b => {
          const pct = (b.count / maxCount) * 100;
          const height = Math.max(4, Math.round(pct * 0.7));
          return (
            <div key={b.cmc} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{b.count}</div>
              <div style={{ width: '100%', height, borderRadius: '2px 2px 0 0', minHeight: 2, background: 'var(--border)', border: '1px solid var(--border-light)', transition: 'height 0.3s' }} />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{b.label || b.cmc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        <span>Avg CMC: <strong style={{ color: 'var(--text)' }}>{stats.avg_cmc}</strong></span>
        <span>Total: <strong style={{ color: 'var(--text)' }}>{stats.total_cards}</strong></span>
      </div>
    </div>
  );
}