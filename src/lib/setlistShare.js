// Guest links (`/?setlist=<token>`).
//
// A church setlist's link is LIVE: the row points at the setlist's server row
// and the guest reads the current setlist + songs through the
// `get_shared_setlist` RPC (20261031_live_share_links.sql), which leaves out
// who leads each song and everything else about people. A personal setlist, or
// a project without that migration, still publishes a frozen snapshot.
//
// A link ends 3 hours after the service (24 hours after sharing when the
// setlist has no date). There is no picker: the service decides.

import { supabase } from '@/auth/supabase';
import { formatClockTime } from '@/lib/dateFormat';
import { parseSongMd } from '@/parser';
import { songFromFlat } from '@/arrangements';
import { songFromDoc } from '@/sync/songDoc';

// Sharing needs a backend — degrade gracefully when Supabase isn't configured.
export const SHARE_ENABLED = !!supabase;

// URL-safe random token. 22 chars from a 36-symbol alphabet ≈ 113 bits —
// well past brute-force range for a public, expiring read link.
function makeToken() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(22);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function buildShareUrl(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/?setlist=${token}`;
}

// Read the share token from the current URL, if any.
export function shareTokenFromUrl() {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.search).get('setlist');
  // Minimum raised to 16 (legacy tokens were 16 chars; current are 22) so a
  // short, guessable token can't even be attempted.
  return t && /^[a-z0-9]{16,32}$/.test(t) ? t : null;
}

// Collect just the songs a setlist references, so the public snapshot doesn't
// leak the owner's whole library.
function songsForSetlist(setlist, songs) {
  const wanted = new Set();
  (setlist.items || []).forEach(it => {
    if (it && it.type !== 'break' && it.songId) wanted.add(it.songId);
  });
  return (songs || []).filter(s => wanted.has(s.id));
}

const HOUR = 3600000;
const AFTER_SERVICE = 3 * HOUR;
const UNDATED = 24 * HOUR;
const DEFAULT_RUN = 3 * HOUR; // a service with no end time (openingMode agrees)

// `YYYY-MM-DD` + `HH:MM`, device time — the leader's wall clock.
function at(date, time) {
  if (!date || !/^\d{2}:\d{2}$/.test(time || '')) return null;
  const ms = new Date(`${date}T${time}:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** When a guest link for this setlist stops working (ms). */
export function shareEndsAt(setlist, now = Date.now()) {
  const start = at(setlist?.date, setlist?.time) ?? at(setlist?.date, '23:59');
  if (start == null) return now + UNDATED;
  const end = at(setlist.date, setlist.endTime);
  const ends = (end != null && end > start ? end : start + DEFAULT_RUN) + AFTER_SERVICE;
  // A link made after its own service has ended still gets a working day.
  return ends > now ? ends : now + UNDATED;
}

/** "Sun 1 Nov, 14:30" */
export function endsLabel(ms, clockFormat = '24h') {
  const d = new Date(ms);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day}, ${formatClockTime(hm, clockFormat)}`;
}

// Postgres/PostgREST errors that mean "this project hasn't run the live-link
// migration yet": an unknown column on insert, an unknown function on read.
const missing = (error) => ['42703', 'PGRST204', 'PGRST202', '42883'].includes(error?.code);

/**
 * Create a guest link. With `teamId` + `rowId` it is live; otherwise (or if the
 * project lacks the migration) a snapshot.
 */
export async function createSetlistShare(setlist, songs, { ownerId, teamId, rowId, now = Date.now() } = {}) {
  if (!supabase) throw new Error('Sharing is unavailable right now.');
  if (!ownerId) throw new Error('Sign in to create a share link.');
  const token = makeToken();
  const expires_at = new Date(shareEndsAt(setlist, now)).toISOString();
  const base = { token, owner_id: ownerId, title: setlist.name || 'Setlist', expires_at };
  if (teamId && rowId) {
    // `setlist` keeps only the id, so the leader can find their link again.
    const { error } = await supabase.from('shared_setlists').insert({
      ...base, team_id: teamId, setlist_row_id: rowId, setlist: { id: setlist.id }, songs: [],
    });
    if (!error) return { token, url: buildShareUrl(token), expiresAt: expires_at, live: true };
    if (!missing(error)) throw error;
  }
  const { error } = await supabase.from('shared_setlists').insert({
    ...base, setlist, songs: songsForSetlist(setlist, songs),
  });
  if (error) throw error;
  return { token, url: buildShareUrl(token), expiresAt: expires_at, live: false };
}

/** The leader's working link for this setlist, if any. */
export async function findSetlistShare(setlist, ownerId) {
  if (!supabase || !ownerId || !setlist?.id) return null;
  const { data, error } = await supabase
    .from('shared_setlists')
    .select('token, expires_at, created_at')
    .eq('owner_id', ownerId)
    .eq('setlist->>id', setlist.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? { token: row.token, url: buildShareUrl(row.token), expiresAt: row.expires_at } : null;
}

/** Move a link's end when the service moved. Quietly does nothing without the update policy. */
export async function moveShareEnd(token, expiresAt) {
  if (!supabase || !token) return;
  await supabase.from('shared_setlists').update({ expires_at: expiresAt }).eq('token', token);
}

// A row from the RPC's `songs` is `{ key, doc, content }`; a snapshot's is the
// song object itself.
function guestSong(row) {
  if (!row || typeof row !== 'object') return null;
  if (!('key' in row) || 'arrangements' in row || 'sections' in row) return row;
  const fromDoc = songFromDoc(row.doc, row.key, Date.now(), null);
  if (fromDoc) return fromDoc;
  try { return songFromFlat({ ...parseSongMd(row.content || ''), id: row.key }); } catch { return null; }
}

/**
 * Fetch a guest link by token (no account needed). Returns null when it's
 * missing or ended. `{ live, title, setlist, songs, church, expires_at }`.
 */
export async function fetchSharedSetlist(token) {
  if (!supabase) throw new Error('Sharing is unavailable right now.');
  const rpc = await supabase.rpc('get_shared_setlist', { p_token: token });
  let data = rpc.data;
  if (rpc.error) {
    if (!missing(rpc.error)) throw rpc.error;
    // Before the migration: the old public read.
    const old = await supabase
      .from('shared_setlists')
      .select('token, title, setlist, songs, expires_at, created_at')
      .eq('token', token)
      .maybeSingle();
    if (old.error) throw old.error;
    data = old.data;
  }
  if (!data) return null;
  const items = (data.setlist?.items || []).map(({ leadBy: _lead, ...it }) => it);
  return {
    live: !!data.live,
    title: data.title,
    setlist: { ...(data.setlist || {}), items },
    songs: (data.songs || []).map(guestSong).filter(Boolean),
    church: data.church || null,
    expires_at: data.expires_at || null,
  };
}

export async function revokeSetlistShare(token) {
  if (!supabase) return;
  const { error } = await supabase.from('shared_setlists').delete().eq('token', token);
  if (error) throw error;
}
