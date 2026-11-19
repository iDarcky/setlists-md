// ── Live follow ──────────────────────────────────────────────────────────────
// One person leads; everyone else's chart moves with theirs: the song AND the
// section. Built on a Realtime BROADCAST channel, so nothing is stored and no
// table or migration is involved: it is a message between open screens.
// Without Supabase (guest mode, tests) it falls back to BroadcastChannel,
// which links tabs of the same browser, enough to try it on one computer.
//
// Owner's questions 7–9 are open; built on Claude's picks: whoever taps Lead
// leads (a newer Lead takes over), followers follow automatically while live,
// touching the chart pauses it and one tap goes back to the band.

import { supabase as supabaseJs } from '@/auth/supabase';

export interface FollowPos { idx: number; slot: number }
export type FollowMsg =
  /** `since`: when the sender tapped Lead. The latest tap wins everywhere. */
  | { type: 'pos'; from: string; name: string; at: number; since: number; pos: FollowPos }
  | { type: 'stop'; from: string; at: number };

export interface FollowState {
  /** Who leads now, if anyone has been heard from recently. */
  leader: { id: string; name: string; seen: number; since: number } | null;
  /** The leader's last position. */
  pos: FollowPos | null;
}

// shortcut: "the latest Lead tap wins" compares phone clocks; a few seconds
// of skew between two phones could pick the wrong one if both tap at once.
/** A leader not heard from for this long is gone (they send every 4s). */
export const LEADER_TIMEOUT_MS = 12_000;
export const HEARTBEAT_MS = 4_000;

/** Pure: what one incoming message does to the follow state. */
export function applyFollowMsg(state: FollowState, msg: FollowMsg, me: string): FollowState {
  if (msg.from === me) return state;
  if (msg.type === 'stop') {
    return state.leader?.id === msg.from ? { leader: null, pos: null } : state;
  }
  // A newer leader replaces an older one: the last to tap Lead wins, even if
  // the old leader's heartbeat is still on its way.
  if (state.leader && state.leader.id !== msg.from && msg.since < state.leader.since) return state;
  return { leader: { id: msg.from, name: msg.name, seen: Date.now(), since: msg.since }, pos: msg.pos };
}

/** Pure: should a screen that leads since `mySince` hand over to this message? */
export function yieldsTo(mySince: number, msg: FollowMsg, me: string): boolean {
  return msg.type === 'pos' && msg.from !== me && msg.since > mySince;
}

/** Pure: is the leader still there? */
export function leaderAlive(state: FollowState, now: number): boolean {
  return !!state.leader && now - state.leader.seen < LEADER_TIMEOUT_MS;
}

export interface FollowTransport {
  send: (msg: FollowMsg) => void;
  close: () => void;
}

interface Channel {
  on: (kind: string, filter: { event: string }, cb: (p: { payload: FollowMsg }) => void) => Channel;
  subscribe: () => Channel;
  send: (m: { type: string; event: string; payload: FollowMsg }) => void;
}
const supabase = supabaseJs as unknown as { channel: (topic: string, opts?: unknown) => Channel; removeChannel: (c: Channel) => unknown } | null;

export function openFollow(room: string, onMsg: (m: FollowMsg) => void): FollowTransport {
  if (supabase) {
    const ch = supabase
      .channel(`chart-follow:${room}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'follow' }, ({ payload }) => onMsg(payload))
      .subscribe();
    return {
      send: msg => ch.send({ type: 'broadcast', event: 'follow', payload: msg }),
      // removeChannel, not unsubscribe: supabase-js hands back an existing
      // channel for the same topic, and adding a listener to a used one throws.
      // Reopening the chart (or StrictMode's double effect) would hit that.
      close: () => { supabase.removeChannel(ch); },
    };
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel(`chart-follow:${room}`);
    bc.onmessage = e => onMsg(e.data as FollowMsg);
    return { send: msg => bc.postMessage(msg), close: () => bc.close() };
  }
  return { send: () => {}, close: () => {} };
}
