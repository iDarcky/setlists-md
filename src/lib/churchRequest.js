// "Ask to start a church": during the beta churches are set up by hand. The
// request is a row in the existing `feedback` table (anyone may insert, only
// the service role reads), tagged so it is easy to find:
//   select created_at, description from feedback
//   where description like '[church request]%' order by created_at desc;

const SENT_KEY = 'setlists-md:church-request';
export const CHURCH_REQUEST_TAG = '[church request]';

/** The feedback row's description: one line per answer, tag first. */
export function churchRequestText({ church, place, people, note, email, name, from, kind }) {
  const lines = [
    `${CHURCH_REQUEST_TAG} ${church.trim()}`,
    kind === 'band' ? 'Kind: band or small group' : null,
    `Where: ${place.trim()}`,
    people?.trim() ? `People: ${people.trim()}` : null,
    `From: ${[name?.trim(), email].filter(Boolean).join(' · ')}`,
    from ? `Came from: ${from}` : null,
    note?.trim() ? `Note: ${note.trim()}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

export async function sendChurchRequest(supabase, { userId, ...answers }) {
  if (!supabase) throw new Error('This needs a connection to Setlists.md. Try again in a moment.');
  const { error } = await supabase.from('feedback').insert({
    user_id: userId ?? null,
    type: 'general',
    description: churchRequestText(answers),
    user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
  });
  if (error) throw error;
}

/** `{ church, kind, at, done? }` once this device has asked for this account, else null. */
export function sentChurchRequest(userId, storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(SENT_KEY) || 'null');
    return v && v.userId === userId ? v : null;
  } catch { return null; }
}

export function rememberChurchRequest(userId, church, storage = globalThis.localStorage, kind = 'church') {
  try { storage?.setItem(SENT_KEY, JSON.stringify({ userId, church, kind, at: Date.now() })); } catch { /* private mode */ }
}

/** The request was approved and the "ready" screen seen: never show it again. */
export function finishChurchRequest(userId, storage = globalThis.localStorage) {
  const v = sentChurchRequest(userId, storage);
  if (!v) return;
  try { storage?.setItem(SENT_KEY, JSON.stringify({ ...v, done: true })); } catch { /* private mode */ }
}

/** "Change the request": back to the first question. */
export function forgetChurchRequest(userId, storage = globalThis.localStorage) {
  if (!sentChurchRequest(userId, storage)) return;
  try { storage?.removeItem(SENT_KEY); } catch { /* private mode */ }
}
