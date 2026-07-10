const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  // Decks
  getDecks: () => request<import('./types').Deck[]>('/decks'),
  getDeck: (id: number) => request<import('./types').Deck>(`/decks/${id}`),
  createDeck: (name: string, cardList: string, color?: string) =>
    request<{ id: number; name: string; results: import('./types').CardResult[] }>('/decks', {
      method: 'POST',
      body: JSON.stringify({ name, card_list: cardList, color }),
    }),
  renameDeck: (id: number, name: string) =>
    request<{ ok: boolean }>(`/decks/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteDeck: (id: number) => request<{ ok: boolean }>(`/decks/${id}`, { method: 'DELETE' }),
  updateDeckColor: (id: number, color: string) =>
    request<{ ok: boolean }>(`/decks/${id}/color`, { method: 'PUT', body: JSON.stringify({ color }) }),
  updateDeckCommander: (id: number, commanderName: string, commanderImageUrl: string) =>
    request<{ ok: boolean }>(`/decks/${id}/commander`, {
      method: 'PUT',
      body: JSON.stringify({ commander_name: commanderName, commander_image_url: commanderImageUrl }),
    }),
  getDeckStats: (id: number) => request<import('./types').CmcStats>(`/decks/${id}/stats`),
  getDeckColorIdentity: (id: number) =>
    request<{ color_identity: string[] }>(`/decks/${id}/color-identity`),

  // Cards
  getDeckCards: (id: number) => request<import('./types').Card[]>(`/decks/${id}/cards`),
  addCards: (deckId: number, cardList: string) =>
    request<{ results: import('./types').CardResult[] }>(`/decks/${deckId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ card_list: cardList }),
    }),
  clearDeckCards: (deckId: number) =>
    request<{ ok: boolean }>(`/decks/${deckId}/cards`, { method: 'DELETE' }),
  updateCard: (cardId: number, data: Partial<import('./types').Card>) =>
    request<{ ok: boolean }>(`/cards/${cardId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCard: (cardId: number) =>
    request<{ ok: boolean }>(`/cards/${cardId}`, { method: 'DELETE' }),
  refreshCard: (cardId: number) =>
    request<{ ok: boolean; image_url?: string }>(`/cards/${cardId}/refresh`, { method: 'POST' }),

  // Collection
  getCollection: () => request<import('./types').CollectionCard[]>('/collection'),

  // Import
  importMoxfield: (url: string, color?: string) =>
    request<{ id: number; name: string; results: import('./types').CardResult[] }>('/decks/import', {
      method: 'POST',
      body: JSON.stringify({ url, color }),
    }),

  // Images
  refreshDeckImages: (deckId: number) =>
    request<{ ok: boolean }>(`/decks/${deckId}/refresh-images`, { method: 'POST' }),
  refreshAllImages: () => request<{ ok: boolean }>('/refresh-images', { method: 'POST' }),
};