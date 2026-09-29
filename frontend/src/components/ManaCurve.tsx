import type { CmcStats } from '../lib/types';

export function MiniManaCurve({ stats }: { stats: CmcStats | null }) {
  if (!stats?.cmc_bars?.length) return null;
  const maxCount = Math.max(1, ...stats.cmc_bars.map(b => b.count));
  return (
    <div className="curve-mini" aria-hidden="true">
      {stats.cmc_bars.map(b => (
        <div
          key={b.cmc}
          className="curve-bar mini"
          style={{ height: Math.max(2, Math.round((b.count / maxCount) * 16)) }}
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
    <section className="curve-panel">
      <div className="section-head is-sub">
        <h3>Mana Curve</h3>
      </div>
      <div className="curve-bars">
        {stats.cmc_bars.map(b => (
          <div key={b.cmc} className="curve-col">
            <div className="curve-count">{b.count}</div>
            <div
              className="curve-bar"
              style={{ width: '100%', height: Math.max(3, Math.round((b.count / maxCount) * 52)) }}
            />
          </div>
        ))}
      </div>
      <div className="curve-labels">
        {stats.cmc_bars.map(b => (
          <div key={b.cmc} className="curve-label">{b.label || b.cmc}</div>
        ))}
      </div>
      <div className="curve-foot">
        <span>Avg CMC<strong>{stats.avg_cmc}</strong></span>
        <span>Total<strong>{stats.total_cards}</strong></span>
      </div>
    </section>
  );
}
