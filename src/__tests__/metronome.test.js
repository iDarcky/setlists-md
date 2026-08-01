// Element 12 — the click's arithmetic.
//
// The scheduling maths is split out of the audio precisely so it can be tested
// without an AudioContext. A metronome that drifts is worse than no metronome,
// and drift lives in exactly these three functions.
import { describe, it, expect } from 'vitest';
import { beatsPerBar, clampTempo, beatsToSchedule, MIN_BPM, MAX_BPM } from '@/lib/metronome';

describe('beatsPerBar', () => {
  it('takes the numerator — that is how many beats until the accent returns', () => {
    expect(beatsPerBar('4/4')).toBe(4);
    expect(beatsPerBar('3/4')).toBe(3);
    expect(beatsPerBar('6/8')).toBe(6);
    expect(beatsPerBar('12/8')).toBe(12);
    expect(beatsPerBar(' 2/2 ')).toBe(2);
  });

  it('falls back to 4 rather than refusing to click', () => {
    // `time` is free text in the .md frontmatter and plenty of songs leave it
    // blank. A wrong accent is a small annoyance; no metronome is the feature
    // missing.
    expect(beatsPerBar('')).toBe(4);
    expect(beatsPerBar(undefined)).toBe(4);
    expect(beatsPerBar(null)).toBe(4);
    expect(beatsPerBar('common time')).toBe(4);
    expect(beatsPerBar('4')).toBe(4);
    expect(beatsPerBar(4)).toBe(4);
    expect(beatsPerBar('0/4')).toBe(4);   // a bar of nothing is not a bar
    expect(beatsPerBar('17/4')).toBe(4);  // past anything a worship chart means
  });
});

describe('clampTempo', () => {
  it('holds the playable range and rounds to whole bpm', () => {
    expect(clampTempo(120)).toBe(120);
    expect(clampTempo(119.6)).toBe(120);
    expect(clampTempo(10)).toBe(MIN_BPM);
    expect(clampTempo(9000)).toBe(MAX_BPM);
  });

  it('never returns NaN — a NaN tempo schedules infinite beats', () => {
    expect(clampTempo(undefined)).toBe(100);
    expect(clampTempo('fast')).toBe(100);
    expect(clampTempo(null)).toBe(100);
  });
});

describe('beatsToSchedule', () => {
  const base = { now: 0, nextTime: 0, beat: 0, bpm: 120, perBar: 4 };

  it('books only the beats inside the lookahead horizon', () => {
    // 120bpm = 0.5s/beat, 0.12s horizon → the beat at 0 and nothing after.
    const { beats } = beatsToSchedule(base);
    expect(beats.map(b => b.at)).toEqual([0]);
  });

  it('accents beat 1 of each bar and nothing else', () => {
    // A whole bar at once via a wide horizon.
    const { beats } = beatsToSchedule({ ...base, horizon: 2.1 });
    expect(beats.map(b => b.accent)).toEqual([true, false, false, false, true]);
  });

  it('accents on the song’s own bar length, not always four', () => {
    const { beats } = beatsToSchedule({ ...base, perBar: 3, horizon: 2.1 });
    expect(beats.map(b => b.accent)).toEqual([true, false, false, true, false]);
  });

  it('hands back where to resume, so passes join up without a gap or a double', () => {
    const first = beatsToSchedule(base);
    expect(first.nextTime).toBeCloseTo(0.5);
    expect(first.nextBeat).toBe(1);

    // The next pass starts exactly where the last one stopped.
    const second = beatsToSchedule({ ...base, now: 0.4, nextTime: first.nextTime, beat: first.nextBeat });
    expect(second.beats.map(b => b.at)).toEqual([0.5]);
    expect(second.nextBeat).toBe(2);
  });

  it('keeps the beat grid on the audio clock, not on when the timer fired', () => {
    // A late wake (the main thread was busy) must not shift the grid: the beat
    // still lands on the multiple of 0.5 it was always going to land on.
    const { beats } = beatsToSchedule({ ...base, now: 0.49, nextTime: 0.5, beat: 1 });
    expect(beats.map(b => b.at)).toEqual([0.5]);
  });

  it('is bounded, so a stalled clock cannot spin forever', () => {
    const { beats } = beatsToSchedule({ ...base, horizon: 1e6 });
    expect(beats.length).toBe(64);
  });

  it('survives a garbage tempo by clamping rather than looping', () => {
    const { beats, nextTime } = beatsToSchedule({ ...base, bpm: NaN });
    expect(beats.length).toBe(1);
    expect(nextTime).toBeCloseTo(0.6); // clamped to 100bpm
  });
});

describe('catching up after the tab was suspended', () => {
  // A background tab throttles `setInterval` while the AUDIO clock keeps
  // running, so a pass can wake with `nextTime` far behind `now`.
  it('does not book a burst of beats in the past', () => {
    const { beats } = beatsToSchedule({
      now: 30, nextTime: 0.06, beat: 0, bpm: 120, perBar: 4,
    });
    // Every beat must be schedulable — a past `at` is played immediately by
    // Web Audio, which is the machine-gun burst users heard as "out of sync".
    expect(beats.every(b => b.at >= 30)).toBe(true);
    expect(beats.length).toBeLessThan(4);
  });

  it('keeps the bar phase across the gap, so the accent stays on beat one', () => {
    // 120bpm = 0.5s/beat, 4/4. Start at t=0, jump to t=10 → exactly 20 beats
    // missed, so the next beat is a downbeat again.
    const { beats, nextBeat } = beatsToSchedule({
      now: 10, nextTime: 0, beat: 0, bpm: 120, perBar: 4,
    });
    expect(nextBeat % 4).toBe(1);          // one beat consumed past the boundary
    expect(beats[0].accent).toBe(true);
  });

  it('is unchanged when the scheduler is keeping up', () => {
    const ahead = beatsToSchedule({ now: 1, nextTime: 1.05, beat: 3, bpm: 100, perBar: 4 });
    expect(ahead.beats[0].at).toBeCloseTo(1.05, 5);
  });
});
