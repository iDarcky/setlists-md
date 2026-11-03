// Join links — the pure half (docs/PLAN.md §2.3, migration 20261019_join_links).
//
// A church has ONE resettable link, `<origin>/join/<code>`. Anyone holding it
// can ASK to join; an owner/admin/leader approves. Everything here is pure (or
// a try/catch'd localStorage wrapper) so it can be unit-tested without React
// or Supabase.

// Must agree with the DB check `code ~ '^[a-z0-9]{8,32}$'`. Codes are minted
// lower-case; links typed or autocorrected to upper-case still resolve.
const CODE_RE = /^[a-z0-9]{8,32}$/;

/** Normalise a code (trim, lower-case). Returns null if it can't be a code. */
export function normalizeJoinCode(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  return CODE_RE.test(s) ? s : null;
}

/**
 * `/join/<code>` → code. Tolerates a trailing slash and a pasted full URL;
 * anything else (including `/join/` alone and `/join/a/b`) is null.
 */
export function parseJoinPath(pathname) {
  let p = String(pathname ?? '');
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    return null;
  }
  const m = /^\/join\/([^/?#]+)\/?$/i.exec(p);
  if (!m) return null;
  let seg = m[1];
  try { seg = decodeURIComponent(seg); } catch { return null; }
  return normalizeJoinCode(seg);
}

/** The shareable URL for a code. */
export function joinUrl(origin, code) {
  const base = String(origin || '').replace(/\/+$/, '');
  return `${base}/join/${code}`;
}

/**
 * A `mailto:` link that opens the leader's own email app with the join link
 * written out. The app has no mail server of its own, so the leader sends it.
 */
export function inviteMailto({ email, teamName, url }) {
  const name = teamName || 'our team';
  const subject = `Join ${name} on Setlists.md`;
  const body = [
    `Hi! Tap this link to join ${name} on Setlists.md:`,
    '',
    url,
    '',
    'Sign in with this email address and you are in. With any other address, ask to join and I will approve you.',
  ].join('\n');
  return `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ── "What do you play or sing?" ─────────────────────────────────────────────
// `id` is what the request stores in `parts`. The six instrument ids are the
// canonical tokens of data/instruments.js (`vocals` is a retired-but-valid
// token), so approval copies them straight into `team_members.instruments`;
// Sound desk / Something else are not instruments and stay on the request.
export const JOIN_PARTS = [
  { id: 'vocals', label: 'Vocals' },
  { id: 'acoustic-guitar', label: 'Acoustic guitar' },
  { id: 'electric-guitar', label: 'Electric guitar' },
  { id: 'bass-guitar', label: 'Bass' },
  { id: 'keys', label: 'Keys' },
  { id: 'drums', label: 'Drums' },
  { id: 'sound-desk', label: 'Sound desk' },
  { id: 'lyrics-slides', label: 'Lyrics / slides' },
  { id: 'other', label: 'Something else' },
];

const PART_LABELS = new Map(JOIN_PARTS.map(p => [p.id, p.label]));

/** Label for a stored part; unknown values are shown as typed. */
export function joinPartLabel(id) {
  return PART_LABELS.get(id) || String(id ?? '');
}

/** Toggle a part in a selection, keeping JOIN_PARTS order. */
export function toggleJoinPart(selected, id) {
  const set = new Set(selected || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  return JOIN_PARTS.map(p => p.id).filter(x => set.has(x));
}

// ── Pending code across the sign-in redirect ────────────────────────────────
// OAuth leaves the page and a magic link opens a new tab on `/`, so the code
// rides in localStorage until the flow finishes. `stage` says how far it got:
//   'auth'      — opened the link, not signed in yet → resume after sign-in
//   'requested' — asked to join; reopen Waiting on the next launch, so nobody
//                 waits inside the app as if they were already in
export const PENDING_JOIN_KEY = 'setlists-md:pending-join';
// A link opened a week ago and abandoned should not hijack a later launch.
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function savePendingJoin(code, stage = 'auth', now = Date.now(), { requestId = null } = {}) {
  const c = normalizeJoinCode(code);
  if (!c) return;
  try {
    const v = { code: c, stage, at: now };
    if (requestId) v.requestId = requestId;
    localStorage.setItem(PENDING_JOIN_KEY, JSON.stringify(v));
  } catch { /* private mode / blocked storage — the flow still works in-tab */ }
}

export function loadPendingJoin(now = Date.now()) {
  try {
    const raw = localStorage.getItem(PENDING_JOIN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const code = normalizeJoinCode(v?.code);
    if (!code) return null;
    if (typeof v.at === 'number' && now - v.at > PENDING_TTL_MS) return null;
    const out = { code, stage: v.stage === 'requested' ? 'requested' : 'auth', at: v.at };
    if (typeof v.requestId === 'string' && v.requestId) out.requestId = v.requestId;
    return out;
  } catch {
    return null;
  }
}

/**
 * The decision to announce for the request this device is waiting on, or
 * null. Only that request counts: an older request that was approved earlier
 * (asking, being let in, leaving, asking again) must not announce "You're in"
 * while the new one is still pending. A record saved before the request id
 * was kept falls back to "decided after this device asked".
 */
export function joinDecisionFor(rows, pending) {
  if (!pending || pending.stage !== 'requested') return null;
  const list = Array.isArray(rows) ? rows : [];
  const mine = pending.requestId
    ? list.filter(r => r && r.id === pending.requestId)
    : list.filter(r => r && r.decided_at && typeof pending.at === 'number' && Date.parse(r.decided_at) >= pending.at);
  return mine.find(r => r.status === 'approved' || r.status === 'declined') || null;
}

export function clearPendingJoin() {
  try { localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* ignore */ }
}

/**
 * Should the app open the join flow on launch? Yes for a `/join/<code>` URL;
 * otherwise to resume a link opened before signing in, or the Waiting screen of a
 * request still being decided, once a user exists.
 */
export function shouldResumeJoin({ pathCode, pending, signedIn }) {
  if (pathCode) return true;
  return !!(pending && signedIn);
}

// ── "<leader> and N others are already in" ──────────────────────────────────
export function alreadyInLine({ leaderName, memberCount }) {
  const n = Math.max(0, Number(memberCount) || 0);
  if (leaderName) {
    const others = Math.max(0, n - 1);
    if (others === 0) return `${leaderName} is already in`;
    return `${leaderName} and ${others} other${others === 1 ? '' : 's'} are already in`;
  }
  if (n === 0) return '';
  return `${n} ${n === 1 ? 'person is' : 'people are'} already in`;
}

/** Two-letter initials for a church with no logo. */
export function churchInitials(name) {
  const words = String(name || '').replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase();
}

/**
 * Which screen a peek result opens on.
 *   error   — invalid / disabled / no answer
 *   landing — signed out: who invited you + sign-in
 *   in      — already a member
 *   waiting — a request is pending
 *   about   — signed in, nothing pending: name + parts → Ask to join
 */
export function joinStepFor({ peek, signedIn }) {
  if (!peek || peek.status !== 'ok') return 'error';
  if (!signedIn) return 'landing';
  if (peek.is_member) return 'in';
  if (peek.my_status === 'pending') return 'waiting';
  return 'about';
}

/** The request this flow is about, from `list_my_join_requests` rows. */
export function findJoinRequest(rows, { teamId, requestId } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (requestId) {
    const byId = list.find(r => r.id === requestId);
    if (byId) return byId;
  }
  if (!teamId) return null;
  // Newest first from the RPC; prefer a pending one, then the latest decision.
  return list.find(r => r.team_id === teamId && r.status === 'pending')
    || list.find(r => r.team_id === teamId)
    || null;
}

/** A peek in the shape the joining screens take. */
export function churchFromPeek(peek) {
  return { name: peek?.team_name || '', logoUrl: peek?.logo_url || null, initials: peek?.initials || null };
}
