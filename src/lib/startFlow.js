import { parseJoinPath, normalizeJoinCode } from '@/lib/joinLink';

const joinLinkFns = { parseJoinPath, normalizeJoinCode };

// What a signed-in account with no church or band sees (the "after sign-up"
// screens): pick church / band / invite link, then Waiting for approval until
// we set it up by hand, then "X is ready" once. Pure, so it can be tested.
//
// `request` is the stored request (lib/churchRequest `sentChurchRequest`, or
// the copy in the account's metadata from another device): { church, kind,
// at, done? }. `pendingJoin` is a parked join link (lib/joinLink): its own
// flow (Waiting for a leader) covers that person, so this one stays out.

export const START_SKIP_VIEWS = ['join', 'auth-callback', 'recovery', 'google-drive-callback', 'share-view', 'loading', 'signin', 'onboarding'];

/** 'choose' | 'waiting' | 'ready' | null */
export function startScreen({ signedIn, teamsLoaded, teamCount, pendingJoin, request, view }) {
  if (!signedIn || !teamsLoaded) return null;
  if (START_SKIP_VIEWS.includes(view)) return null;
  if (pendingJoin) return null;
  if (teamCount > 0) return request && !request.done ? 'ready' : null;
  if (request && !request.done) return 'waiting';
  return 'choose';
}

/** The request this account made, from this device or (else) its metadata. */
export function storedRequest(local, metadata) {
  if (local) return local;
  const m = metadata?.start_request;
  if (m && typeof m === 'object' && typeof m.church === 'string' && m.church) {
    return { church: m.church, kind: m.kind === 'band' ? 'band' : 'church', at: m.at || null, done: !!m.done };
  }
  return null;
}

/** Sizes offered on the request form. */
export const SIZES = {
  church: ['Up to 10', '11 to 30', 'More than 30', 'Not sure'],
  band: ['Up to 5', '6 to 10'],
};

/** A join code from what someone pasted: the whole link, the link without
 *  https://, or the bare code. Null when it is none of those. */
export function inviteCodeFrom(raw, { parseJoinPath, normalizeJoinCode } = joinLinkFns) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/\/join\//i.test(s)) {
    const url = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
    return parseJoinPath(url);
  }
  if (/[\s/]/.test(s)) return null;
  return normalizeJoinCode(s);
}
