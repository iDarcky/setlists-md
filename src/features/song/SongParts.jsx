import { cn } from '@/ui/shadcn/utils';
import { useCoverArt } from '@/lib/useCoverArt';

// Pieces the song page and the Songs side panel share (QA 11 Nov, the
// MultiTracks-style rebuild): the cover, the one-line numbers, the leader's
// play sentence and the song map.

/** Spotify art, else the YouTube still, else a plain green tile (the brand green, no letters). Never an empty box. */
export function Cover({ song, size = 104, className }) {
  const { artUrl, markFailed } = useCoverArt(song);
  const box = { width: size, height: size };
  if (artUrl) {
    return <img src={artUrl} alt="" onError={() => markFailed(artUrl)} style={box} className={cn('shrink-0 rounded-[10px] object-cover shadow-[0_8px_24px_rgba(0,0,0,.45)]', className)} />;
  }
  return (
    <span aria-hidden="true" style={{ ...box, background: 'linear-gradient(135deg,#7AA89C 0%,#53796F 55%,#2B403A 100%)' }}
      className={cn('block shrink-0 rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,.45)]', className)} />
  );
}

/** "Key G  BPM 90  Time 3/4  Length 3:45": a label, then the value. Empty values drop out. */
export function Fact({ label, children }) {
  if (children == null || children === '' || children === false) return null;
  return <span className="whitespace-nowrap"><b className="font-semibold text-foreground">{label}</b> <span className="text-muted-foreground">{children}</span></span>;
}

export function MetaLine({ children, className }) {
  return <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]', className)}>{children}</div>;
}

const fmtDay = (d) => (d ? String(d) : null);

/** "Played 6 times, last on 2 Nov, usually in G." Nothing at all for a song never played. */
function playedSentence({ plays = 0, last = null, usualKey = '' } = {}) {
  if (!plays) return null;
  return [
    ['Played ', plays === 1 ? 'once' : `${plays} times`],
    last && [', last on ', fmtDay(last)],
    usualKey && [', usually in ', usualKey],
  ].filter(Boolean);
}

export function Played({ facts, className }) {
  const parts = playedSentence(facts);
  if (!parts) return null;
  return (
    <p className={cn('m-0 text-[14px] text-muted-foreground', className)}>
      {parts.map(([lead, v]) => <span key={lead}>{lead}<span className="text-foreground">{v}</span></span>)}.
    </p>
  );
}

/** The play order as coloured chips (V1 V2 C …), `{ code, fg, bg }` from sectionTone. */
export function SongMap({ codes, className }) {
  if (!codes?.length) return null;
  return (
    <div aria-label="Song map" className={cn('flex flex-wrap gap-1', className)}>
      {codes.map((c, n) => {
        const t = typeof c === 'string' ? { code: c } : c;
        return (
          <span key={n} style={t.fg ? { color: t.fg, background: t.bg } : undefined}
            className={cn('flex h-6 min-w-7 items-center justify-center rounded-[6px] px-1.5 text-[12px] font-semibold', !t.fg && 'bg-selected text-link')}>{t.code}</span>
        );
      })}
    </div>
  );
}
