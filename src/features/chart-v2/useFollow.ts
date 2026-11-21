import { useCallback, useEffect, useRef, useState } from 'react';
import { applyFollowMsg, HEARTBEAT_MS, leaderAlive, openFollow, yieldsTo, type FollowPos, type FollowState, type FollowTransport } from './follow';

export type FollowRole = 'off' | 'leading' | 'following' | 'paused';

/**
 * The chart's side of live follow. `room` is null when there is nothing to
 * follow (not live, no setlist). Returns the role, the leader's name, and
 * calls `onMove` when the leader moves while this screen follows.
 */
export function useFollow({ room, name, pos, onMove }: {
  room: string | null;
  name: string;
  pos: FollowPos;
  onMove: (pos: FollowPos) => void;
}) {
  const [me] = useState(() => Math.random().toString(36).slice(2, 10));
  // When this screen tapped Lead (0 = not leading).
  const [leadSince, setLeadSince] = useState(0);
  const leading = leadSince > 0;
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<FollowState>({ leader: null, pos: null });
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  const tx = useRef<FollowTransport | null>(null);
  const moveRef = useRef(onMove);
  const pausedRef = useRef(paused);
  const sinceRef = useRef(leadSince);
  useEffect(() => { moveRef.current = onMove; pausedRef.current = paused; sinceRef.current = leadSince; });

  useEffect(() => {
    if (!room) return;
    const t = openFollow(room, msg => {
      const mine = sinceRef.current;
      if (mine && !yieldsTo(mine, msg, me)) return; // still leading
      if (mine) { sinceRef.current = 0; setLeadSince(0); } // someone tapped Lead after me
      const prev = stateRef.current;
      const next = applyFollowMsg(prev, msg, me);
      stateRef.current = next;
      setState(next);
      // Move only when the band actually moved: a heartbeat repeats the same
      // place, and two screens never measure a section edge quite alike.
      const moved = next.pos && (next.pos.idx !== prev.pos?.idx || next.pos.slot !== prev.pos?.slot);
      if (moved && next.pos && !pausedRef.current) moveRef.current(next.pos);
    });
    tx.current = t;
    return () => { t.close(); tx.current = null; };
  }, [room, me]);

  // The leader sends where they are when it changes, and every few seconds so
  // a screen that joins late (or reconnects) catches up.
  const send = useCallback(() => {
    if (sinceRef.current) tx.current?.send({ type: 'pos', from: me, name, at: Date.now(), since: sinceRef.current, pos });
  }, [me, name, pos]);
  useEffect(() => { if (leading) send(); }, [leading, send]);
  useEffect(() => {
    if (!room) return;
    const id = setInterval(() => {
      setNow(Date.now());
      send();
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [room, send]);

  const lead = useCallback(() => {
    setPaused(false);
    stateRef.current = { leader: null, pos: null };
    setState(stateRef.current);
    const t = Date.now();
    sinceRef.current = t;
    setLeadSince(t);
  }, []);
  const stopLeading = useCallback(() => {
    sinceRef.current = 0;
    setLeadSince(0);
    tx.current?.send({ type: 'stop', from: me, at: Date.now() });
  }, [me]);
  const pause = useCallback(() => { if (!pausedRef.current) setPaused(true); }, []);
  const resume = useCallback(() => {
    setPaused(false);
    if (state.pos) moveRef.current(state.pos);
  }, [state.pos]);

  const alive = leaderAlive(state, now);
  const role: FollowRole = !room ? 'off' : leading ? 'leading' : alive ? (paused ? 'paused' : 'following') : 'off';
  return { role, leaderName: alive ? state.leader?.name ?? '' : '', lead, stopLeading, pause, resume, bandPos: alive ? state.pos : null };
}
