export interface Deck {
  id: number;
  name: string;
  color: string;
  commander_name: string;
  commander_image_url: string;
  commander2_name: string;
  commander2_image_url: string;
  card_count: number;
  total_cards: number;
  color_identity: string;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: number;
  deck_id: number;
  card_name: string;
  quantity: number;
  set_code: string;
  scryfall_id: string;
  image_url: string;
  mana_cost: string;
  colors: string;
  color_identity: string;
  cmc: number;
  type_line: string;
  is_foil: number;
  /** EUR paper prices, both finishes, null when the printing has no listing. */
  price_eur?: number | null;
  price_eur_foil?: number | null;
}

export interface CollectionCard {
  card_name: string;
  scryfall_id: string;
  image_url: string;
  set_code: string;
  type_line: string;
  mana_cost: string;
  colors: string;
  color_identity: string;
  cmc: number;
  total_quantity: number;
  deck_count: number;
  is_foil: number;
  price_eur?: number | null;
  price_eur_foil?: number | null;
  decks: { name: string; color: string }[];
}

export interface CmcStats {
  cmc_bars: { cmc: number; count: number; label?: string }[];
  total_cards: number;
  avg_cmc: number;
}

export interface CardRuling {
  comment: string;
  published_at: string;
}

export interface CardDetail {
  name_en: string;
  name_de: string;
  name_ja: string;
  oracle_text: string;
  rulings: CardRuling[];
  price_eur?: number | null;
  price_eur_foil?: number | null;
}

/** Window labels shared by the price charts, mirroring the Meta tab's language. */
export type PriceWindow = '30D' | '90D' | '1Y' | 'ALL';

export interface DeckValue {
  id: number;
  name: string;
  color: string;
  value: number;
  /** Percentage change vs the closest snapshot ≥30 days old; null without one. */
  delta_30d: number | null;
}

export interface PriceSummary {
  currency: string;
  total: number;
  delta_30d: number | null;
  priced_rows: number;
  unpriced_rows: number;
  /** SQL timestamp of the newest snapshot, null before the first one. */
  last_snapshot: string | null;
  decks: DeckValue[];
}

export interface CollectionHistoryPoint {
  date: string;
  total: number;
  /** Deck id (as a string key) → that deck's value on this day. */
  decks: Record<string, number>;
}

export interface CollectionHistory {
  currency: string;
  window: PriceWindow;
  points: CollectionHistoryPoint[];
  decks: { id: number; name: string; color: string }[];
}

export interface CardHistoryPoint {
  date: string;
  eur: number | null;
  eur_foil: number | null;
}

export interface CardHistory {
  currency: string;
  window: PriceWindow;
  scryfall_id: string;
  points: CardHistoryPoint[];
}

export interface CardResult {
  status: 'ok' | 'not_found';
  requested: string;
  quantity: number;
  resolved?: string;
  image_url?: string;
}

export interface MetaEntry {
  id: string;
  standing: number | null;
  wins: number;
  wins_bracket: number;
  wins_swiss: number;
  player: string;
  tournament_name: string;
  tournament_date: string;
  tournament_size: number;
}

/** Filter window the backend actually queried edhtop16 with (post-clamp). */
export interface MetaFilters {
  time_period: string;
  min_event_size: number;
}

export interface MetaDeckOverview extends MetaFilters {
  commander: string;
  deck_id: number;
  entries: MetaEntry[];
}

export interface MetaCompareCard {
  name: string;
  mana_cost: string;
  image_url: string;
  quantity: number;
}

export interface MetaCompareResult {
  entry: MetaEntry;
  meta_maindeck_count: number;
  overlap: MetaCompareCard[];
  missing_from_mine: MetaCompareCard[];
  my_cards_not_in_meta: MetaCompareCard[];
}

export interface MetaStockEntryRef {
  id: string;
  standing: number | null;
  wins: number;
  player: string;
  tournament_name: string;
  tournament_date: string;
  tournament_size: number;
}

export interface MetaStockCard {
  name: string;
  mana_cost: string;
  image_url: string;
  type: string;
  count: number;
  share: number;
  quantity: number;
  in_my_deck: boolean;
  in_decks: string[];
}

export interface MetaStockResult extends MetaFilters {
  commander: string;
  deck_id: number;
  top_n: number;
  decks_analyzed: number;
  analyzed_entries: MetaStockEntryRef[];
  stock: MetaStockCard[];
  missed_count: number;
}

export interface MulliganCard {
  name: string;
  mana_cost: string;
  image_url: string;
  type_line: string;
  /** Copies of this card in the deck — a 4-of can legitimately show up twice. */
  quantity: number;
}

export interface MulliganEnemy {
  /** edhtop16 commander key: "A" solo, "A / B" for partners. */
  name: string;
  image_url: string;
}

export interface MulliganDeal {
  deck_id: number;
  deck_name: string;
  /** 1–4; cEDH pods seat four. */
  seat: number;
  /** Cards that must be shipped this round (0–4). */
  ship_count: number;
  hand: MulliganCard[];
  enemies: MulliganEnemy[];
}

export interface ApiError {
  error: string;
}