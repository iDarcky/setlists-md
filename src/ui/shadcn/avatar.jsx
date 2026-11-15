import { churchInitials } from '@/lib/joinLink';
import { cn } from './utils';

// A person or a church: their photo, or their initials in a circle.
// One part everywhere (top bar, team, band, schedule, You, notifications).
//   tone brand: link fill, page-colour ink (you, the church, people who said yes)
//   tone quiet: raised fill, foreground ink (everyone else in a crowded row)
// Initials use the type scale: 10px only on the tiny stacked faces, then
// caption 12 up to 32px, small 14 to 40px, heading 18 to 64px, title 24 above.
// Photos get a hairline so a dark photo still has an edge on a dark card.

const ink = (size) => (
  size <= 24 ? 'text-[10px]'
    : size <= 32 ? 'text-caption'
      : size <= 40 ? 'text-small'
        : size <= 64 ? 'text-heading'
          : 'text-title'
);

function Avatar({ name, url, size = 32, tone = 'brand', ring = false, title, className }) {
  const box = cn(
    'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold leading-none',
    ring && 'shadow-[0_0_0_2px_var(--card)]',
    className,
  );
  if (url) {
    return (
      <span aria-hidden="true" title={title} className={box} style={{ width: size, height: size }}>
        <img src={url} alt="" className="size-full object-cover" />
        <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      title={title}
      className={cn(box, ink(size), tone === 'quiet' ? 'bg-raised text-foreground' : 'bg-link text-background')}
      style={{ width: size, height: size }}
    >
      {churchInitials(name)}
    </span>
  );
}

/** Overlapping faces (the band on a schedule row). `people`: { id, name, url, on }. */
function AvatarStack({ people, max = 6, size = 24, className }) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className={cn('flex items-center', className)}>
      {shown.map((p, i) => (
        <Avatar key={p.id ?? i} name={p.name} url={p.url} size={size} tone={p.on ? 'brand' : 'quiet'} ring title={p.name} className={i > 0 ? '-ml-1.5' : undefined} />
      ))}
      {more > 0 && <span className="ml-1.5 text-caption text-muted-foreground">+{more}</span>}
    </span>
  );
}

export { Avatar, AvatarStack };
