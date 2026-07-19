// Per-device "what shows on a card" model — the card-view equivalent of
// tableColumns, for the Songs/Setlists Card + Compact views. Stored per device
// (localStorage, NOT synced) since it's a personal display preference.

export const CARD_FIELDS = {
  songs: [
    { id: 'art', label: 'Cover art' },
    { id: 'artist', label: 'Artist' },
    { id: 'key', label: 'Key' },
    { id: 'tempo', label: 'Tempo' },
    { id: 'tags', label: 'Tags' },
    { id: 'songMap', label: 'Song map' },
    { id: 'media', label: 'Spotify / YouTube' },
    { id: 'updated', label: 'Last edited' },
  ],
  setlists: [
    { id: 'service', label: 'Service' },
    { id: 'songs', label: 'Song count' },
    { id: 'duration', label: 'Duration' },
    { id: 'tags', label: 'Tags' },
  ],
};

export const CARD_DEFAULT = {
  songs: ['art', 'artist', 'key', 'tags', 'songMap'],
  setlists: ['service', 'songs', 'tags'],
};

// Visible field ids as a Set, honoring the saved array or the per-kind default.
export function resolveCardFields(kind, saved) {
  const all = (CARD_FIELDS[kind] || []).map(f => f.id);
  const arr = Array.isArray(saved) ? saved : null;
  const vis = new Set();
  for (const id of all) {
    const on = arr ? arr.includes(id) : CARD_DEFAULT[kind].includes(id);
    if (on) vis.add(id);
  }
  return vis;
}

export function toggleCardField(kind, saved, id) {
  const all = (CARD_FIELDS[kind] || []).map(f => f.id);
  const vis = resolveCardFields(kind, saved);
  if (vis.has(id)) vis.delete(id); else vis.add(id);
  return all.filter(x => vis.has(x));
}

export function defaultCardFields(kind) {
  const all = (CARD_FIELDS[kind] || []).map(f => f.id);
  return all.filter(id => CARD_DEFAULT[kind].includes(id));
}
