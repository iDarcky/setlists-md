// Canonical, serialization-independent change detection for sync.
//
// THE PROBLEM THIS SOLVES: both engines used to decide "did this item change?"
// by hashing the exact serialized bytes — `quickHash(songToMd(song))` on push
// vs `quickHash(storedContent)` on pull. When two app versions serialize the
// same song even slightly differently (frontmatter key order, a defaulted-vs-
// omitted field, trailing whitespace), the byte hashes diverge, every sync
// looks like an edit, and the item re-uploads forever (phantom "edited" spam +
// realtime loops).
//
// THE FIX: hash a *normalized semantic* form instead of raw bytes. We run the
// markdown back through `parseSongMd` (the parser is tolerant and far more
// stable across versions than the serializer) and hash the parsed structure.
// Two builds that serialize differently but *mean* the same thing now produce
// the SAME hash — so no phantom re-upload, regardless of version skew.

import { parseSongMd } from '@/parser';

// Bumped when the change-detection hash algorithm changes. Manifests written by
// an older algorithm carry a lower version; the first sync after an upgrade
// re-baselines them via time-based comparison instead of treating the hash
// change as a content edit (which would flag the whole library as conflicted).
export const HASH_VERSION = 2;

// cyrb53 — a fast 53-bit non-cryptographic hash. Replaces the old 32-bit
// quickHash, whose narrow space risked a collision making a real edit look
// unchanged (a silent-loss path) on large libraries.
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Deterministic stringify — recursively sorts object keys and drops undefined,
// so the same logical value always serializes identically regardless of key
// order (JSONB reordering, pretty-print vs compact, etc.).
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

// Memoize by the markdown string — the pull side hashes the same stored content
// on every sync, so this avoids re-parsing unchanged rows.
const songHashMemo = new Map();

// Canonical fingerprint of a song's MARKDOWN form. `md` is the serialized song
// (from `songToMd(song)` on push, or the stored `content` on pull).
export function canonicalSongHash(md) {
  if (typeof md !== 'string') md = String(md ?? '');
  const cached = songHashMemo.get(md);
  if (cached) return cached;
  // Exclude fields that aren't part of the song's *content*:
  //  - tabLibrary: resolved references, not round-tripped uniformly.
  //  - id / songId / arrangementId: identity handles. They're tracked
  //    separately by the manifest, and a brand-new/legacy song mints an
  //    arrangementId on first serialization — including it here would make that
  //    one-time minting (and any cross-device id divergence) look like a content
  //    edit and trigger a needless re-upload.
  const { tabLibrary, id, songId, arrangementId, ...parsed } = parseSongMd(md);
  void tabLibrary; void id; void songId; void arrangementId;
  const h = cyrb53(stableStringify(parsed));
  if (songHashMemo.size > 5000) songHashMemo.clear();
  songHashMemo.set(md, h);
  return h;
}

// Canonical fingerprint of a setlist. Accepts an object (local copy) or a JSON
// string (rare). Key-order-independent, so JSONB reordering never registers as
// a change.
export function canonicalSetlistHash(sl) {
  const obj = typeof sl === 'string' ? safeParse(sl) : sl;
  return cyrb53(stableStringify(obj ?? null));
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}
