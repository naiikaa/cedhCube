export interface Deck {
  id: number;
  name: string;
  color: string;
  commander_name: string;
  commander_image_url: string;
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
  decks: { name: string; color: string }[];
}

export interface CmcStats {
  cmc_bars: { cmc: number; count: number; label?: string }[];
  total_cards: number;
  avg_cmc: number;
}

export interface CardResult {
  status: 'ok' | 'not_found';
  requested: string;
  quantity: number;
  resolved?: string;
  image_url?: string;
}

export interface ApiError {
  error: string;
}