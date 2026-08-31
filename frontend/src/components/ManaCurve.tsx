import type { CmcStats } from '../lib/types';

export function MiniManaCurve({ stats }: { stats: CmcStats | null }) {
  if (!stats?.cmc_bars?.length) return null;
  const maxCount = Math.max(1, ...stats.cmc_bars.map(b => b.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16, marginTop: 5 }} aria-hidden="true">
      {stats.cmc_bars.map(b => (
        <div
          key={b.cmc}
          className="curve-bar mini"
          style={{ width: 6, height: Math.max(2, Math.round((b.count / maxCount) * 16)) }}
          title={`${b.label || b.cmc}: ${b.count}`}
        />
      ))}
    </div>
  );
}

export function FullManaCurve({ stats }: { stats: CmcStats | null }) {
  if (!stats?.cmc_bars?.length) return null;
  const maxCount = Math.max(1, ...stats.cmc_bars.map(b => b.count));
  return (
    <section style={{ margin: '0.9rem 0 1rem' }}>
      <div className="section-head">
        <h3>Mana Curve</h3>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 4, height: 76,
        padding: '0 0.25rem', borderBottom: '1px solid var(--border)',
      }}>
        {stats.cmc_bars.map(b => (
          <div key={b.cmc} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{b.count}</div>
            <div
              className="curve-bar"
              style={{ width: '100%', height: Math.max(3, Math.round((b.count / maxCount) * 52)), transition: 'height 0.3s ease' }}
            />
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{b.label || b.cmc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1.1rem', marginTop: 7, fontSize: '0.72rem', color: 'var(--text-dim)' }}>
        <span>Avg CMC <strong style={{ color: 'var(--text)' }}>{stats.avg_cmc}</strong></span>
        <span>Total <strong style={{ color: 'var(--text)' }}>{stats.total_cards}</strong></span>
      </div>
    </section>
  );
}
