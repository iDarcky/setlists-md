// Public-domain song catalog.
//
// The catalog is deliberately a NETWORK resource: it will grow past what any
// device should download (many languages × thousands of songs), so it is never
// bundled, never precached, and searched server-side. Until the Supabase table
// + `search_catalog` RPC land, this module answers from the bundled demo songs
// so the Add-a-song UI can be built and tested against its final shape.
//
// Everything here is async and abort-aware on purpose — swapping the body of
// `searchCatalog`/`fetchCatalogSong` for a Supabase call must not require the
// callers to change.
import { DEMO_SONGS_MD } from '@/data/demos';
import { parseSongMd } from '@/parser';
import { searchSongs } from './search';

// Flip to true when the server-side catalog exists. While false the UI treats
// the catalog as a small built-in sample and skips the offline messaging.
export const CATALOG_IS_REMOTE = false;

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Local stand-in for the catalog table. Each entry mirrors the columns the
// remote rows will carry, so result rendering never changes.
let localEntries = null;
function getLocalEntries() {
  if (localEntries) return localEntries;
  localEntries = DEMO_SONGS_MD.map((md, i) => {
    let meta = { title: 'Untitled', artist: '', key: '' };
    try {
      const p = parseSongMd(md);
      meta = { title: p.title, artist: p.artist, key: p.key };
    } catch { /* keep defaults */ }
    return {
      id: `local-${i}`,
      slug: slugify(meta.title) || `song-${i}`,
      title: meta.title,
      artist: meta.artist || '',
      author: meta.artist || '',
      key: meta.key || '',
      language: 'en',
      year: null,
      firstLine: '',
      license: 'public-domain',
      featured: i === 0,
      md,
    };
  });
  return localEntries;
}

/**
 * Search the catalog. Returns [] for an empty query.
 *
 * @param {string} query
 * @param {{ signal?: AbortSignal, languages?: string[], limit?: number }} opts
 * @returns {Promise<Array>} catalog entries
 */
export async function searchCatalog(query, { signal, limit = 20 } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  // Local mode reuses the app's own search engine, which already folds
  // diacritics — the remote version gets the same behaviour from `unaccent`.
  return searchSongs(getLocalEntries(), q, { limit });
}

/**
 * The idle-state list, shown before the user types anything. Curated rather
 * than measured — see the catalog plan; `featured` is an editorial flag.
 */
export async function fetchFeatured({ signal, limit = 4 } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return getLocalEntries().slice(0, limit);
}

/**
 * Fetch a catalog entry's markdown. Separate from search because the remote
 * search returns metadata only — song bodies are fetched one at a time, on add.
 */
export async function fetchCatalogSong(entry, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (entry?.md) return entry.md;
  throw new Error('Song body unavailable');
}
