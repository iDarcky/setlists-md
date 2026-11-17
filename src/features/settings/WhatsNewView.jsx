import { useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Spinner } from '@/ui/shadcn/spinner';
import { ChevronDownIcon } from '@/app/navIcons';
import { capSections, bulletCount, inlineSegments, sectionLabel } from '@/lib/changelog';
import { Group, GroupLabel } from './SettingsViews';

// What's new, rebuilt (owner, 2026-11-09). The release you're on is open at
// the top; every earlier one is a single row that opens in place, five at a
// time behind "Show older". A long release shows its first eight bullets.
// Pure view: WhatsNewPanel loads and parses the changelog.

export const PAGE_SIZE = 5;
export const BULLET_LIMIT = 8;

function Inline({ text }) {
  return inlineSegments(text).map((s, i) => {
    if (s.type === 'bold') return <b key={i} className="font-semibold text-foreground">{s.text}</b>;
    if (s.type === 'italic') return <em key={i}>{s.text}</em>;
    if (s.type === 'code') return <code key={i} className="rounded-[4px] bg-raised px-1 font-mono text-[0.9em]">{s.text}</code>;
    if (s.type === 'link') return <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-4 hover:underline">{s.text}</a>;
    return s.text;
  });
}

function ReleaseNotes({ release }) {
  const [all, setAll] = useState(false);
  const total = bulletCount(release);
  const sections = capSections(release, all ? null : BULLET_LIMIT);
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s, i) => (
        <section key={s.name + i} className="flex flex-col gap-2">
          {s.name && (
            <h3 className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {sectionLabel(s.name)}
            </h3>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {s.items.map((item, j) => (
              <li key={j} className="relative pl-4 text-[15px] leading-[22px] text-muted-foreground">
                <span aria-hidden="true" className="absolute left-0.5 top-[9px] size-[5px] rounded-full bg-muted-foreground/60" />
                <Inline text={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {total > BULLET_LIMIT && (
        <div>
          <Button variant="link" className="text-[15px]" onClick={() => setAll((v) => !v)}>
            {all ? 'Show less' : `Show all ${total}`}
          </Button>
        </div>
      )}
    </div>
  );
}

const Meta = ({ release }) => (
  <span className="text-[13px] text-muted-foreground">
    {release.version}{release.date && ` · ${release.date}`}
  </span>
);

/**
 * @param {Array} releases  parsed and filtered, newest first (null = loading)
 * @param {number} current  index of the release this build is
 * @param {string} [error]
 */
export function WhatsNewView({ releases, current = 0, error }) {
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState(PAGE_SIZE);

  if (error) {
    return <p className="m-0 px-1 pt-2 text-[15px] text-muted-foreground">{error}</p>;
  }
  if (!releases) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground" role="status" aria-label="Loading">
        <Spinner className="size-5" />
      </div>
    );
  }
  if (!releases.length) return null;

  const top = releases[current];
  const older = releases.filter((_, i) => i !== current);
  const visible = older.slice(0, shown);
  const left = older.length - visible.length;

  return (
    <div className="flex flex-col">
      <Group className="mt-2 flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">
            You’re on {top.version}{top.date && ` · ${top.date}`}
          </span>
          <h2 className="m-0 text-[20px] font-semibold leading-[26px] tracking-[-0.2px]">{top.title}</h2>
        </div>
        <ReleaseNotes release={top} />
      </Group>

      {visible.length > 0 && (
        <>
          <GroupLabel>Earlier</GroupLabel>
          <Group>
            {visible.map((r) => {
              const isOpen = open === r.version;
              const id = `rel-${r.version.replace(/\W/g, '-')}`;
              return (
                <div key={r.version} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    onClick={() => setOpen(isOpen ? null : r.version)}
                    className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left font-sans text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[15px] font-medium leading-[20px]">{r.title}</span>
                      <Meta release={r} />
                    </span>
                    <span className={cn('shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}>
                      <ChevronDownIcon size={18} />
                    </span>
                  </button>
                  {isOpen && (
                    <div id={id} className="px-4 pb-5 pt-1">
                      <ReleaseNotes release={r} />
                    </div>
                  )}
                </div>
              );
            })}
          </Group>
        </>
      )}

      {left > 0 && (
        <Button variant="outline" className="mt-4 w-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
          Show older ({left})
        </Button>
      )}
    </div>
  );
}
