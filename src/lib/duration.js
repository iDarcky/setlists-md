// Song-duration helpers. Durations are stored as human strings in the .md
// frontmatter / arrangement (`duration`), e.g. "3:45". A bare number is read
// as minutes ("4" → 4 min) since that's the natural thing to type for a song
// length; "m:ss" / "h:mm:ss" are parsed as clock time.

export function durationToSeconds(value) {
  if (value == null) return 0;
  const s = String(value).trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const parts = s.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 60) : 0; // bare number = minutes
}

// Clock time for a transport readout: "0:00" / "3:45" / "72:30". Used by both
// backing-track transports (the Song Hub's bar and the reader's practice row),
// which is why it isn't a local helper in either of them.
export function formatClock(sec) {
  if (!sec || !Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Compact total for set summaries: "45 min" / "1h 5m".
export function formatTotalDuration(totalSeconds) {
  const mins = Math.round((totalSeconds || 0) / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
