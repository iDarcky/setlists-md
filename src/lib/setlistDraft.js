// A new setlist that was not saved yet, kept on this device as it is made, so
// a phone that kills the app halfway loses nothing: the New setlist pop-up
// then offers "Continue your setlist". One per group (library).
const KEY = 'setlists:newDraft:';

export function readNewDraft(space) {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY + space) : null;
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' && v.id ? v : null;
  } catch {
    return null;
  }
}

export function writeNewDraft(space, draft) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!draft) localStorage.removeItem(KEY + space);
    else localStorage.setItem(KEY + space, JSON.stringify(draft));
  } catch { /* full or private mode: nothing kept */ }
}
