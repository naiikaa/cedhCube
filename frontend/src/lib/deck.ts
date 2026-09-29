import type { Deck } from './types';

/** One commander slot, in list order (slot 1 first). */
export type CommanderPick = { name: string; image: string };

/**
 * A deck's commanders as a 0–2 entry list, so every surface can iterate instead
 * of branching on the two column pairs. Partner decks fill both slots.
 */
export const deckCommanders = (deck: Deck): CommanderPick[] =>
  [
    { name: deck.commander_name, image: deck.commander_image_url },
    { name: deck.commander2_name, image: deck.commander2_image_url },
  ].filter(c => !!c.name);
