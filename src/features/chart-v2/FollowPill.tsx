import type { FollowRole } from './useFollow';

interface Props {
  role: FollowRole;
  leaderName: string;
  /** Section name the band is in, for "Back to the band". */
  bandAt?: string;
  onLead: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

/**
 * The one place follow shows itself: a frosted pill above the footer
 * (canvas row 9/10). Nobody leading: "Lead the band". Leading: "You're
 * leading". Following: "Following Dana", tap to pause. Paused (you touched
 * the chart): "Back to the band".
 */
export function FollowPill({ role, leaderName, bandAt, onLead, onStop, onPause, onResume }: Props) {
  const base = 'pointer-events-auto inline-flex h-9 min-h-0 items-center gap-2 rounded-full border border-border/70 px-3.5 text-small font-semibold shadow-[0_8px_24px_rgba(0,0,0,.3)] backdrop-blur-md backdrop-saturate-150';
  const dot = (on: boolean) => <span aria-hidden className={`size-2 rounded-full ${on ? 'bg-link shadow-[0_0_0_3px_color-mix(in_srgb,var(--link)_25%,transparent)]' : 'bg-muted-foreground'}`} />;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-chrome flex justify-center">
      {role === 'off' && (
        <button type="button" onClick={onLead} className={`${base} bg-raised/70 text-foreground`}>
          {dot(false)}Lead the band
        </button>
      )}
      {role === 'leading' && (
        <button type="button" onClick={onStop} aria-label="You're leading. Tap to stop leading" className={`${base} bg-raised/70 text-foreground`}>
          {dot(true)}You’re leading<span className="font-normal text-muted-foreground">Stop</span>
        </button>
      )}
      {role === 'following' && (
        <button type="button" onClick={onPause} aria-label={`Following ${leaderName}. Tap to pause`} className={`${base} bg-raised/70 text-foreground`}>
          {dot(true)}Following {leaderName || 'the leader'}
        </button>
      )}
      {role === 'paused' && (
        <button type="button" onClick={onResume} className={`${base} bg-primary text-primary-foreground`}>
          Back to the band{bandAt ? <span className="font-normal opacity-70">{bandAt}</span> : null}
        </button>
      )}
    </div>
  );
}
