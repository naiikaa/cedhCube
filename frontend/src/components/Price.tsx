import { TrendingDown, TrendingUp } from 'lucide-react';
import type { PriceSummary } from '../lib/types';

/** Anything carrying the two EUR price columns: a deck card or a collection entry. */
export interface Priced {
  is_foil: number;
  price_eur?: number | null;
  price_eur_foil?: number | null;
}

const EUR = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const EUR_COMPACT = new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

export const fmtEur = (value: number) => EUR.format(value);
export const fmtEurCompact = (value: number) => EUR_COMPACT.format(value);

/**
 * The price a single copy is worth: the finish it was flagged as, falling back
 * to the other finish when that printing only lists one. Null means "no listing",
 * which must stay visually distinct from a €0.00 card.
 */
export function unitPrice(card: Priced): number | null {
  const { price_eur: normal = null, price_eur_foil: foil = null } = card;
  const picked = card.is_foil ? foil ?? normal : normal ?? foil;
  return picked ?? null;
}

/** `13 Sep 2026, 04:00` from the backend's `YYYY-MM-DD HH:MM:SS`; unparseable passes through. */
export function fmtSnapshot(ts: string | null): string {
  if (!ts) return 'never';
  const d = new Date(ts.replace(' ', 'T') + (ts.endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Signed percentage move, up in teal / down in pink. Absent history renders nothing. */
export function PriceDelta({ delta, suffix = '30d' }: { delta: number | null; suffix?: string }) {
  if (delta === null || delta === undefined) return null;
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`price-delta ${up ? 'up' : 'down'}`}>
      <Icon size={11} aria-hidden="true" />
      {up ? '+' : ''}{delta.toFixed(1)}% {suffix}
    </span>
  );
}

/** Grid line: one copy's price, or an explicit "no listing" marker (never €0.00). */
export function CardPrice({ card }: { card: Priced }) {
  const unit = unitPrice(card);
  return (
    <span className="coll-price">
      {unit === null
        ? <span className="no-price">— no price</span>
        : <span className="price-value">{fmtEur(unit)}</span>}
      {card.is_foil ? <span className="price-finish">foil</span> : null}
    </span>
  );
}

/** Card-detail money box: unit price, the owned quantity, and the product. */
export function PriceBox({ card, quantity }: { card: Priced; quantity: number }) {
  const unit = unitPrice(card);
  return (
    <div className="price-box">
      {unit === null ? (
        <>
          <span className="price-box-amount no-price">— no price</span>
          <span className="price-box-note">no EUR listing for this printing</span>
        </>
      ) : (
        <>
          <span className="price-box-amount">{fmtEur(unit)}</span>
          <span className="price-box-note">
            price{card.is_foil ? ' (foil)' : ''} ×{quantity} = {fmtEur(unit * quantity)}
          </span>
        </>
      )}
    </div>
  );
}

/** Header HUD money box: the whole collection at paper value, plus its sync note. */
export function CollectionValue({ summary }: { summary: PriceSummary | null }) {
  return (
    <div className="value-hud">
      <div className="value-box">
        <span className="value-amount">{summary ? fmtEur(summary.total) : '—'}</span>
        <span className="value-caption">Collection Value</span>
      </div>
      <span className="value-note">
        daily snapshot · 04:00 · last {fmtSnapshot(summary?.last_snapshot ?? null)}
        {summary && summary.unpriced_rows > 0 ? ` · ${summary.unpriced_rows} unpriced` : ''}
      </span>
    </div>
  );
}
