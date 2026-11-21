import type { ReactNode } from 'react';
import { ExternalLink, PlaySquare, Disc3 } from 'lucide-react';
import { cn } from '@/ui/shadcn/utils';
import { ListRow } from '@/ui/typed';
import type { Arrangement, Facts, SongView } from './typed';

// The song page's About tab (approved mockup v3, owner 2026-11-20): how the
// band plays it, then the arrangements, links, credits and tags. Only what is
// filled in shows; an empty field is never a "—".

const heading = 'm-0 px-1 pb-2 pt-6 text-small font-medium text-muted-foreground first:pt-2';
const card = 'overflow-hidden rounded-card material-base';

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : String(v || '').split(','))
    .map(s => String(s).trim())
    .filter(Boolean);

/** Two by two: times played, last time, usual key, usual tempo. */
function Played({ facts }: { facts: Facts }) {
  const cells: [ReactNode, string, boolean?][] = [
    [facts.plays === 1 ? 'Once' : `${facts.plays} times`, 'played'],
    [facts.last, 'last time'],
    [facts.usualKey, 'usual key', true],
    [facts.usualTempo ? `${facts.usualTempo} BPM` : null, 'usual tempo'],
  ];
  const shown = cells.filter(([v]) => v != null && v !== '');
  return (
    <div className={cn(card, 'grid grid-cols-2')}>
      {shown.map(([value, label, gold], n) => (
        <div key={label} className={cn('flex flex-col gap-0.5 px-4 py-3', n % 2 === 1 && 'border-l border-border', n > 1 && 'border-t border-border')}>
          <span className={cn('text-heading font-semibold', gold && 'font-mono text-[var(--chord)]')}>{value}</span>
          <span className="text-small text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

function Link({ href, title, icon }: { href: string; title: string; icon: ReactNode }) {
  return (
    <ListRow as="a" href={href} target="_blank" rel="noopener noreferrer" title={title} sub="Opens in a new tab" size="compact"
      leading={icon} trailing={<ExternalLink size={16} strokeWidth={1.8} className="text-muted-foreground" />}
      className="cursor-pointer no-underline outline-none hover:bg-raised focus-visible:bg-raised" />
  );
}

export function SongAbout({ song, facts, arrangements, leader }: {
  song: SongView;
  facts: Facts;
  arrangements: Arrangement[];
  leader: boolean;
}) {
  const credits: [string, string][] = ([
    ['Writers', song.writers],
    ['Publishers', song.publishers],
    ['Copyright', [song.copyright, song.ccli && `CCLI ${song.ccli}`].filter(Boolean).join(', ')],
    ['Album', [song.album, song.year].filter(Boolean).join(', ')],
    ['Label', song.label],
    ['Original title', song.originaltitle],
    ['Language', song.language],
    ['Translator', song.translator],
    ['Vocal range', song.vocalrange],
    ['Bible', song.scripture],
  ] as [string, string | undefined][]).filter((c): c is [string, string] => !!c[1] && String(c[1]).trim() !== '');
  const tags = [...new Set([...(song.tags || []), ...list(song.themes)])];
  const links = [
    song.youtube && { href: song.youtube, title: 'YouTube', icon: <PlaySquare size={20} strokeWidth={1.8} /> },
    song.spotify && { href: song.spotify, title: 'Spotify', icon: <Disc3 size={20} strokeWidth={1.8} /> },
  ].filter(Boolean) as { href: string; title: string; icon: ReactNode }[];
  const played = facts.plays > 0;
  const many = arrangements.length > 1; // one arrangement is already the header

  if (!played && !many && !links.length && !credits.length && !tags.length) {
    return (
      <p className="m-0 px-5 pt-8 text-center text-body text-muted-foreground">
        Nothing here yet.{leader ? ' Add credits and links in Edit.' : ''}
      </p>
    );
  }

  return (
    <div className="flex flex-col px-4 pb-28 pt-2">
      {played && <><h2 className={heading}>Played</h2><Played facts={facts} /></>}
      {many && (
        <>
          <h2 className={heading}>Arrangements</h2>
          <div className={card}>
            {arrangements.map(a => (
              <ListRow key={a.id} title={a.name}
                sub={[a.tempo && `${a.tempo} BPM`, Number(a.capo) > 0 && `capo ${a.capo}`, a.isDefault && 'default'].filter(Boolean).join(', ') || undefined}
                trailing={a.key ? <span className="font-mono text-small font-semibold text-[var(--chord)]">{a.key}</span> : undefined} />
            ))}
          </div>
        </>
      )}
      {links.length > 0 && (
        <>
          <h2 className={heading}>Links</h2>
          <div className={card}>{links.map(l => <Link key={l.title} {...l} />)}</div>
        </>
      )}
      {credits.length > 0 && (
        <>
          <h2 className={heading}>Credits</h2>
          <div className={card}>
            {credits.map(([k, v]) => <ListRow key={k} size="compact" weight="regular" title={v} sub={k} />)}
          </div>
        </>
      )}
      {tags.length > 0 && (
        <>
          <h2 className={heading}>Tags</h2>
          <div className="flex flex-wrap gap-1.5 px-1">
            {tags.map(t => <span key={t} className="rounded-full bg-raised px-3 py-1 text-small">{t}</span>)}
          </div>
        </>
      )}
    </div>
  );
}
