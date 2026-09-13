import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { LineChart } from 'lucide-react';
import { api } from '../lib/api';
import type { CollectionHistory, PriceWindow } from '../lib/types';
import { fmtEur, fmtEurCompact } from './Price';

/**
 * Hand-rolled SVG line charts. This project ships no charting library — its
 * other chart (the mana curve) is drawn from primitives too — and two panels do
 * not justify one. Everything here is driven by the theme's CSS variables.
 */

const WINDOWS: PriceWindow[] = ['30D', '90D', '1Y', 'ALL'];

/** Deck lines cycle ice → violet → teal, matching the approved prototype. */
const DECK_LINE_COLORS = ['var(--accent)', 'var(--accent-alt)', 'var(--success)', 'var(--chrome, var(--text-dim))'];

const VIEW_W = 1000;
const VIEW_H = 240;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const GRID_LINES = 4;

export interface Series {
  key: string;
  label: string;
  color: string;
  /** One value per x slot; null leaves a gap. */
  values: (number | null)[];
  /** Draw a gradient area below the line (used for the collection total). */
  area?: boolean;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** `2026-09-13` → `13 Sep`. */
function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function xAt(index: number, count: number) {
  return count < 2 ? VIEW_W / 2 : (index / (count - 1)) * VIEW_W;
}

/** Value scale: `[0, max]` for the axed panel, tight `[min, max]` for a sparkline. */
interface Scale { min: number; max: number }

function yAt(value: number, scale: Scale) {
  const usable = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const span = scale.max - scale.min;
  return VIEW_H - PAD_BOTTOM - (span <= 0 ? usable / 2 : ((value - scale.min) / span) * usable);
}

function linePath(values: (number | null)[], scale: Scale) {
  let path = '';
  let pen = 'M';
  values.forEach((v, i) => {
    if (v === null) { pen = 'M'; return; }
    path += `${pen}${xAt(i, values.length).toFixed(2)} ${yAt(v, scale).toFixed(2)} `;
    pen = 'L';
  });
  return path.trim();
}

function areaPath(values: (number | null)[], scale: Scale) {
  const drawn = values.map((v, i) => ({ v, i })).filter(p => p.v !== null);
  if (drawn.length < 2) return '';
  const base = VIEW_H - PAD_BOTTOM;
  const head = `M${xAt(drawn[0].i, values.length).toFixed(2)} ${base}`;
  const body = drawn
    .map(p => `L${xAt(p.i, values.length).toFixed(2)} ${yAt(p.v as number, scale).toFixed(2)}`)
    .join(' ');
  const tail = `L${xAt(drawn[drawn.length - 1].i, values.length).toFixed(2)} ${base} Z`;
  return `${head} ${body} ${tail}`;
}

interface ChartProps {
  labels: string[];
  series: Series[];
  /** Rendered height in CSS pixels. */
  height?: number;
  /** Hide gridlines, axis ticks and value labels (sparkline mode). */
  bare?: boolean;
  gradientId: string;
}

function Chart({ labels, series, height = 240, bare = false, gradientId }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const scale = useMemo<Scale>(() => {
    const points = series.flatMap(s => s.values.filter((v): v is number => v !== null));
    const peak = Math.max(0, ...points);
    if (bare) {
      // Sparkline: a tight window around the data, so a 2% move is visible.
      const low = Math.min(...points);
      const pad = (peak - low) * 0.15 || Math.max(peak * 0.05, 0.01);
      return { min: low - pad, max: peak + pad };
    }
    // Axed panel: zero-based, ceiling rounded so gridline labels read cleanly.
    if (peak <= 0) return { min: 0, max: 1 };
    const step = 10 ** Math.floor(Math.log10(peak));
    return { min: 0, max: Math.ceil(peak / step) * step };
  }, [series, bare]);

  const gridValues = bare
    ? []
    : Array.from({ length: GRID_LINES }, (_, i) => (scale.max / GRID_LINES) * (i + 1));
  const hoverIndex = hover !== null && hover >= 0 && hover < labels.length ? hover : null;

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    setHover(Math.round(ratio * (labels.length - 1)));
  };

  return (
    <div className="price-chart" style={{ height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={series.map(s => s.label).join(', ')}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--money)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--money)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map(v => (
          <line key={v} className="chart-grid"
            x1="0" x2={VIEW_W} y1={yAt(v, scale)} y2={yAt(v, scale)} vectorEffect="non-scaling-stroke" />
        ))}

        {series.map(s => (
          <g key={s.key}>
            {s.area && <path d={areaPath(s.values, scale)} fill={`url(#${gradientId})`} />}
            <path className="chart-line" d={linePath(s.values, scale)} stroke={s.color}
              vectorEffect="non-scaling-stroke" />
          </g>
        ))}

        {hoverIndex !== null && (
          <>
            <line className="chart-cursor" x1={xAt(hoverIndex, labels.length)} x2={xAt(hoverIndex, labels.length)}
              y1={PAD_TOP} y2={VIEW_H - PAD_BOTTOM} vectorEffect="non-scaling-stroke" />
            {series.map(s => {
              const v = s.values[hoverIndex];
              return v === null || v === undefined ? null : (
                <circle key={s.key} className="chart-dot" cx={xAt(hoverIndex, labels.length)}
                  cy={yAt(v, scale)} r="4" fill={s.color} vectorEffect="non-scaling-stroke" />
              );
            })}
          </>
        )}
      </svg>

      {!bare && gridValues.map(v => (
        <span key={v} className="chart-tick" style={{ top: `${(yAt(v, scale) / VIEW_H) * 100}%` }}>
          {fmtEurCompact(v)}
        </span>
      ))}

      {hoverIndex !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(xAt(hoverIndex, labels.length) / VIEW_W) * 100}%` }}
        >
          <span className="chart-tooltip-date">{shortDate(labels[hoverIndex])}</span>
          {series.map(s => {
            const v = s.values[hoverIndex];
            return v === null || v === undefined ? null : (
              <span key={s.key} className="chart-tooltip-row">
                <span className="chart-swatch" style={{ background: s.color }} />
                {s.label} <strong>{fmtEur(v)}</strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WindowSelect({ value, onChange }: { value: PriceWindow; onChange: (w: PriceWindow) => void }) {
  return (
    <div className="filter-row" style={{ gap: 4 }}>
      {WINDOWS.map(w => (
        <button key={w} type="button" className="chip" aria-pressed={value === w} onClick={() => onChange(w)}>
          {w}
        </button>
      ))}
    </div>
  );
}

/** Empty-state copy shared by both panels: history needs days to accumulate. */
function ChartHint({ points }: { points: number }) {
  return (
    <div className="chart-empty">
      <LineChart aria-hidden="true" />
      {points === 0
        ? 'No price snapshots yet — the daily snapshot runs at 04:00, or refresh prices now.'
        : 'Only one snapshot so far — the value line appears once a second day is recorded.'}
    </div>
  );
}

/** Collection tab panel: total value in amber plus one line per deck. */
export function ValueHistoryPanel({ onError }: { onError: (msg: string) => void }) {
  const [range, setRange] = useState<PriceWindow>('90D');
  const [history, setHistory] = useState<CollectionHistory | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((w: PriceWindow) => {
    setLoading(true);
    api.getCollectionHistory(w)
      .then(setHistory)
      .catch(e => onError(errText(e)))
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => { load(range); }, [load, range]);

  const points = history?.points ?? [];
  const labels = points.map(p => p.date);
  const series: Series[] = useMemo(() => {
    if (!history) return [];
    const total: Series = {
      key: 'total', label: 'Collection total', color: 'var(--money)', area: true,
      values: history.points.map(p => p.total),
    };
    const decks = history.decks.map((d, i) => ({
      key: String(d.id),
      label: d.name.length > 22 ? `${d.name.slice(0, 20)}…` : d.name,
      color: DECK_LINE_COLORS[i % DECK_LINE_COLORS.length],
      values: history.points.map(p => p.decks[String(d.id)] ?? null),
    }));
    return [total, ...decks];
  }, [history]);

  const latest = points.length > 0 ? points[points.length - 1].total : null;

  return (
    <section className="frame frame-pad value-history" style={{ marginBottom: '1.1rem' }}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h3>
          Collection Value — {range}
          {latest !== null && <span className="value-history-now"> {fmtEur(latest)}</span>}
        </h3>
        <span className="head-action"><WindowSelect value={range} onChange={setRange} /></span>
      </div>

      {loading && !history ? (
        <div className="chart-empty">Loading value history…</div>
      ) : points.length < 2 ? (
        <ChartHint points={points.length} />
      ) : (
        <>
          <Chart labels={labels} series={series} gradientId="value-history-fill" />
          <div className="chart-legend">
            {series.map(s => (
              <span key={s.key} className="chart-legend-item">
                <span className="chart-swatch" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="chart-note">
        Hover for value + date · daily snapshot values today's cards at past prices
      </div>
    </section>
  );
}

/** Card-detail panel: one printing's price over time, drawn in the accent pink. */
export function CardSparkline({ scryfallId, isFoil }: { scryfallId: string; isFoil: boolean }) {
  const [range, setRange] = useState<PriceWindow>('90D');
  const [values, setValues] = useState<{ labels: string[]; data: (number | null)[] } | null>(null);

  useEffect(() => {
    let live = true;
    if (!scryfallId) { setValues({ labels: [], data: [] }); return; }
    api.getCardHistory(scryfallId, range)
      .then(h => {
        if (!live) return;
        setValues({
          labels: h.points.map(p => p.date),
          data: h.points.map(p => (isFoil ? p.eur_foil ?? p.eur : p.eur ?? p.eur_foil)),
        });
      })
      .catch(() => { if (live) setValues({ labels: [], data: [] }); });
    return () => { live = false; };
  }, [scryfallId, range, isFoil]);

  const labels = values?.labels ?? [];
  const data = values?.data ?? [];

  return (
    <div className="card-sparkline">
      <div className="section-head" style={{ marginBottom: 4 }}>
        <span className="meta-label">Price history</span>
        <span className="head-action"><WindowSelect value={range} onChange={setRange} /></span>
      </div>
      {data.filter(v => v !== null).length < 2 ? (
        <ChartHint points={data.length} />
      ) : (
        <Chart
          labels={labels}
          height={104}
          bare
          gradientId={`spark-${scryfallId}`}
          series={[{ key: 'card', label: 'Price', color: 'var(--pink, var(--accent))', values: data }]}
        />
      )}
    </div>
  );
}
