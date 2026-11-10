// "Ask to start a church": during the beta churches are set up by hand. The
// request is a row in the existing `feedback` table (anyone may insert, only
// the service role reads), tagged so it is easy to find:
//   select created_at, description from feedback
//   where description like '[church request]%' order by created_at desc;

const SENT_KEY = 'setlists-md:church-request';
export const CHURCH_REQUEST_TAG = '[church request]';

/** The feedback row's description: one line per answer, tag first. */
export function churchRequestText({ church, place, people, note, email, name, from }) {
  const lines = [
    `${CHURCH_REQUEST_TAG} ${church.trim()}`,
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

/** `{ church, at }` once this device has asked for this account, else null. */
export function sentChurchRequest(userId, storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage?.getItem(SENT_KEY) || 'null');
    return v && v.userId === userId ? v : null;
  } catch { return null; }
}

export function rememberChurchRequest(userId, church, storage = globalThis.localStorage) {
  try { storage?.setItem(SENT_KEY, JSON.stringify({ userId, church, at: Date.now() })); } catch { /* private mode */ }
}
