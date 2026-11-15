import { useState } from 'react';
import { Toaster, sileo } from 'sileo';
import { Plus, Play, Trash2, User, Settings, Moon, ExternalLink, Music, ListMusic, Copy, Pencil, SearchX } from 'lucide-react';
import { Button } from '@/ui/shadcn/button';
import { ListRow, KeyBadge } from '@/ui/shadcn/list-row';
import { SectionLabel, SectionAction } from '@/ui/shadcn/section-label';
import { MenuItem, MenuSeparator, MenuLabel } from '@/ui/shadcn/menu';
import { Segmented } from '@/ui/shadcn/segmented';
import { Chip } from '@/ui/shadcn/chip';
import { Badge } from '@/ui/shadcn/badge';
import { EmptyState, EmptyNote } from '@/ui/shadcn/empty-state';
import { ToastStack } from '@/ui/blocks/ToastStack';
import '@/ui/blocks/tokens.css';

// The design system on one page: materials, layers, type, colours (and, as
// they are matched, every shared component in every place it is used).
// Open the app with `?design`. Nothing in the app links here.

function ChipDemo() {
  const [on, setOn] = useState(['Not played lately']);
  const flip = (t) => setOn(on.includes(t) ? on.filter(x => x !== t) : [...on, t]);
  return (
    <div className="material-base flex flex-col gap-4 rounded-card p-4">
      <div className="flex flex-wrap gap-2">
        {['Key', 'Not played lately', 'Fast', 'Christmas'].map(t => <Chip key={t} on={on.includes(t)} onClick={() => flip(t)}>{t}</Chip>)}
        <Chip dashed>+ Other date</Chip>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="selected">Ready</Badge>
        <Badge variant="selected">You play</Badge>
        <Badge variant="neutral">Draft</Badge>
        <Badge variant="warning">Invited</Badge>
        <Badge variant="warning">Maybe</Badge>
        <Badge variant="danger">Can’t</Badge>
        <Badge variant="outline">Not sent</Badge>
      </div>
    </div>
  );
}

function SegDemo() {
  const [a, setA] = useState('dark');
  const [b, setB] = useState('me');
  const [c, setC] = useState('chart');
  const [d, setD] = useState('24h');
  return (
    <div className="material-base flex flex-col gap-4 rounded-card p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-body">Theme</span><Segmented size="sm" label="Theme" value={a} onChange={setA} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'default', label: 'Auto' }]} /></div>
      <div className="flex items-center justify-between gap-3"><span className="text-body">Time</span><Segmented label="Time" value={d} onChange={setD} options={[{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }]} /></div>
      <Segmented tabs fill value={b} onChange={setB} options={[{ value: 'me', label: 'Me' }, { value: 'band', label: 'Band' }]} />
      <Segmented tabs fill size="sm" className="w-[150px]" value={c} onChange={setC} options={[{ value: 'chart', label: 'Chart' }, { value: 'info', label: 'Info' }]} />
    </div>
  );
}

const MATERIALS = [
  { name: 'base', layer: '0', use: 'Resting card, list group', cls: 'material-base rounded-card' },
  { name: 'small', layer: '0 / sticky', use: 'Lifted row, picked tile', cls: 'material-small rounded-card' },
  { name: 'medium', layer: 'chrome 100', use: 'Nav pill, top bar, Save bar', cls: 'material-medium rounded-card' },
  { name: 'large', layer: 'chrome 100', use: 'Floating panel, preview', cls: 'material-large rounded-card' },
  { name: 'modal', layer: 'modal 300', use: 'Sheet, dialog', cls: 'material-modal rounded-card' },
  { name: 'menu', layer: 'menu 400', use: '⋮ menu, popover, picker', cls: 'material-menu rounded-card' },
  { name: 'tooltip', layer: 'tooltip 500', use: 'Hint', cls: 'material-tooltip rounded-control' },
  { name: 'fullscreen', layer: 'fullscreen 200', use: 'Reader, takeovers', cls: 'material-fullscreen rounded-card border border-dashed !border-border' },
];

const LAYERS = [
  ['z-sticky', 10, 'sticky headers inside a page'],
  ['z-chrome', 100, 'top bar, nav pill, Save bar, selection bar'],
  ['z-fullscreen', 200, 'reader, live intro, full-screen editors'],
  ['z-modal', 300, 'scrim + sheets and dialogs'],
  ['z-menu', 400, 'menus, popovers, pickers (also inside sheets)'],
  ['z-tooltip', 500, 'tooltips'],
  ['z-toast', 600, 'toasts'],
];

const TYPE = [
  ['text-title', '24 / 32 · 600', 'Page titles'],
  ['text-heading', '18 / 24 · 600', 'Sheet and dialog titles, card titles'],
  ['text-body', '16 / 24 · 400', 'Body, inputs on phone, buttons on phone'],
  ['text-small', '14 / 20 · 400–500', 'Rows, secondary text, buttons on iPad/desktop'],
  ['text-caption', '12 / 16 · 400–500', 'Metadata: key, BPM, dates, counts'],
  ['text-label', '12 / 16 · 600 UPPERCASE', 'Section labels'],
];

// Real messages from the app, one of each kind (see the toast inventory).
const SAMPLE_TOASTS = [
  { kind: 'success', title: 'Song added', description: 'Firm Foundation is in your songs.' },
  { kind: 'action', title: 'Song deleted', description: 'Way Maker', button: 'Undo', danger: true },
  { kind: 'error', title: "Couldn't make the link", description: 'Check your connection and try again.' },
  { kind: 'warning', title: 'Offline', description: 'Changes save here and sync later.' },
  { kind: 'info', title: 'Andrei is in', description: 'They can see songs and setlists.' },
];

const COLOURS = ['background', 'card', 'raised', 'float', 'border', 'float-border', 'input', 'foreground', 'muted-foreground', 'link', 'selected', 'danger', 'warning', 'success', 'info'];

function Section({ title, note, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-label text-muted-foreground">{title}</h2>
        {note && <p className="m-0 text-small text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DesignPreview() {
  const [toastPos, setToastPos] = useState('bottom-right');
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
  };

  return (
    <div className="h-dvh overflow-y-auto bg-background font-sans text-foreground">
      <div className="mx-auto flex max-w-[720px] flex-col gap-10 px-4 pb-24 pt-[max(24px,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-title">Design system</h1>
            <p className="m-0 text-small text-muted-foreground">Foundations first, then every shared component where it is used.</p>
          </div>
          <button type="button" onClick={flip} className="h-11 shrink-0 rounded-control border border-input bg-transparent px-4 text-small font-medium text-foreground">
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </header>

        <Section title="Materials" note="One class per elevation: fill, edge and shadow together. Pick by where the surface sits.">
          <div className="grid grid-cols-2 gap-3">
            {MATERIALS.map((m) => (
              <div key={m.name} className={`flex min-h-[88px] flex-col justify-between p-3.5 ${m.cls}`}>
                <span className="font-mono text-caption opacity-70">{m.name} · {m.layer}</span>
                <span className="text-small font-medium">{m.use}</span>
              </div>
            ))}
          </div>
          {/* A stacked scene: rows on the page, a menu over them, a tooltip, the nav pill. */}
          <div className="relative h-[300px] overflow-hidden rounded-card border border-border bg-background">
            <div className="material-base absolute inset-x-3 top-3 flex justify-between rounded-card px-3.5 py-3 text-small"><span>Way Maker</span><span className="text-muted-foreground">G</span></div>
            <div className="material-base absolute inset-x-3 top-[62px] flex justify-between rounded-card px-3.5 py-3 text-small"><span>Firm Foundation</span><span className="text-muted-foreground">⋮</span></div>
            <div className="material-menu absolute right-5 top-[104px] z-menu w-44 rounded-card p-1 text-small">
              <div className="rounded-control bg-raised px-2.5 py-2">Change key</div>
              <div className="px-2.5 py-2">Move</div>
              <div className="px-2.5 py-2">Remove</div>
            </div>
            <div className="material-tooltip absolute left-6 top-[120px] z-tooltip rounded-control px-2.5 py-1.5 text-caption">Capo 2</div>
            <div className="material-medium absolute bottom-3 left-1/2 z-chrome -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-small">Home · Setlists · Songs</div>
          </div>
          <div className="relative h-[220px] overflow-hidden rounded-card border border-border bg-background">
            <div className="material-base absolute inset-x-3 top-3 flex justify-between rounded-card px-3.5 py-3 text-small"><span>Sunday 23 Nov</span><span className="text-muted-foreground">5 songs</span></div>
            <div className="material-medium absolute bottom-[110px] left-1/2 z-chrome -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-small">Home · Setlists · Songs</div>
            <div className="absolute inset-0 z-modal bg-scrim" />
            <div className="material-modal absolute inset-x-0 -bottom-5 z-modal h-[120px] rounded-t-sheet px-5 pt-4">
              <div className="text-heading">Add a song</div>
              <p className="m-0 mt-1 text-small text-muted-foreground">A sheet sits over the scrim and the nav pill.</p>
            </div>
          </div>
        </Section>

        <Section title="Layers" note="Every z-index comes from this list.">
          <div className="material-base divide-y divide-border rounded-card">
            {LAYERS.map(([cls, z, use]) => (
              <div key={cls} className="flex items-baseline gap-3 px-3.5 py-2.5">
                <code className="w-28 shrink-0 font-mono text-caption text-link">{cls}</code>
                <span className="w-10 shrink-0 font-mono text-caption text-muted-foreground">{z}</span>
                <span className="text-small">{use}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type" note="Five sizes plus the section label. Weights 400, 500, 600 only.">
          <div className="material-base divide-y divide-border rounded-card">
            {TYPE.map(([cls, spec, use]) => (
              <div key={cls} className="flex flex-col gap-1 px-3.5 py-3">
                <span className={cls}>Firm Foundation</span>
                <span className="font-mono text-caption text-muted-foreground">{cls} · {spec} · {use}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Button" note="One button. Ink = the one main action on a screen. Outline = the other actions. Ghost = quiet (toolbars, Cancel). Destructive = only for delete. Link = inside a sentence. 44px on phones, 40px from the iPad up; sm is 36px to look at, 44px to tap.">
          <div className="material-base flex flex-col gap-4 rounded-card p-4">
            {[['default', 'Ink'], ['outline', 'Outline'], ['ghost', 'Ghost'], ['destructive', 'Destructive']].map(([v, label]) => (
              <div key={v} className="flex flex-wrap items-center gap-2">
                <span className="w-24 shrink-0 font-mono text-caption text-muted-foreground">{v}</span>
                <Button variant={v}>{v === 'destructive' ? <Trash2 /> : v === 'default' ? <Play /> : null}{label}</Button>
                <Button variant={v} size="sm">{v === 'default' ? <Plus /> : null}Small</Button>
                <Button variant={v} size="icon" aria-label="Add"><Plus /></Button>
                <Button variant={v} disabled>Disabled</Button>
                <Button variant={v} loading>Saving</Button>
              </div>
            ))}
            <p className="m-0 text-small text-muted-foreground">A <Button variant="link">link button</Button> sits inside a sentence.</p>
          </div>
        </Section>

        <Section title="Empty state" note="When a page or list has nothing in it: an icon tile, a title (16 semibold), one or two lines that say what will show up or what to do (14 muted), at most one button. Inside a card or sheet, one quiet line instead.">
          <EmptyState icon={<Music strokeWidth={1.8} />} title="Your song library is empty" action={<Button><Plus size={18} strokeWidth={2} />Add a song</Button>}>Add the songs your church sings: import the files you already have, or type one in.</EmptyState>
          <EmptyState icon={<SearchX strokeWidth={1.8} />} title="No songs match">Try fewer filters or another search.</EmptyState>
          <div className="material-base rounded-card"><EmptyNote>No templates yet.</EmptyNote></div>
        </Section>

        <Section title="Chip and badge" note="Chip = you tap it (filters, dates, tags): round, 36px on phones / 32px on iPad, green edge when on, same text weight both ways. Badge = a status you read (not tappable): 24px, 12px semibold, one colour per meaning everywhere.">
          <ChipDemo />
        </Section>

        <Section title="Segmented" note="Two to four choices in one pill. 40px in settings and sheets, 32px in toolbars. Picked = card fill with a hairline; text 14 medium in both states so nothing jumps. Full width when it switches the view (Me / Band).">
          <SegDemo />
        </Section>

        <Section title="Menu" note="One menu item everywhere: 44px on phones, 40px from the iPad up, text 16 / 14 like the buttons, icon 18 muted. Picked = selected + check. Delete = red, last, after a line.">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex w-60 flex-col rounded-card material-menu p-1">
              <MenuItem icon={<Music strokeWidth={1.8} />}>New song</MenuItem>
              <MenuItem icon={<ListMusic strokeWidth={1.8} />}>New setlist</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Copy strokeWidth={1.8} />}>Duplicate</MenuItem>
              <MenuItem icon={<Pencil strokeWidth={1.8} />} disabled>Move up</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 strokeWidth={1.8} />} danger>Delete section</MenuItem>
            </div>
            <div className="flex w-64 flex-col rounded-card material-menu p-1">
              <MenuLabel>View</MenuLabel>
              <MenuItem selected sub="96 BPM · default" trailing={<span className="font-mono text-small font-semibold text-[var(--chord)]">G</span>}>Sunday</MenuItem>
              <MenuItem selected={false} sub="72 BPM · capo 2" trailing={<span className="font-mono text-small font-semibold text-[var(--chord)]">A</span>}>Acoustic</MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Plus strokeWidth={1.8} />}>New arrangement</MenuItem>
            </div>
          </div>
        </Section>

        <Section title="Section label" note="The small heading above a group. 12px, semibold, uppercase, muted, the same everywhere. It can carry a count and one word on the right.">
          <div className="flex flex-col gap-2">
            <SectionLabel className="px-1">App</SectionLabel>
            <div className="material-base flex flex-col overflow-hidden rounded-card">
              <ListRow size="compact" weight="regular" onClick={() => {}} title="What's new" chevron />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <SectionLabel className="px-1" count={8} action={<SectionAction>Invite</SectionAction>}>Band</SectionLabel>
            <div className="material-base flex flex-col overflow-hidden rounded-card">
              <ListRow onClick={() => {}} title="Estera P." sub="Vocals" chevron />
            </div>
          </div>
        </Section>

        <Section title="List row" note="One row for every list. Title 16, line under it 14 muted. Strong (600) for what the list is made of (songs, setlists), medium for people, regular for settings. 48px one line, 56px two lines. Divider on top, none on the first row. Hover and focus = raised; picked = selected.">
          <div className="material-base flex flex-col overflow-hidden rounded-card">
            <ListRow weight="strong" onClick={() => {}} title="Amazing Grace" sub="Chris Tomlin · Played 3 weeks ago" trailing={<KeyBadge>G</KeyBadge>} />
            <ListRow weight="strong" onClick={() => {}} title="Goodness of God" sub="Bethel · Next Sunday" trailing={<><span className="flex h-6 items-center rounded-full bg-selected px-2.5 text-caption font-semibold text-link">Sun</span><KeyBadge>A</KeyBadge></>} />
            <ListRow weight="strong" selected onClick={() => {}} title="Way Maker" sub="Picked (selected)" trailing={<KeyBadge>E</KeyBadge>} />
          </div>
          <div className="material-base flex flex-col overflow-hidden rounded-card">
            <ListRow onClick={() => {}} leading={<span className="flex size-9 items-center justify-center rounded-full bg-raised text-small font-semibold text-foreground">DM</span>} title="Daniel M." sub="Leader · Keys, Vocals" chevron />
            <ListRow onClick={() => {}} leading={<span className="flex size-9 items-center justify-center rounded-full bg-raised text-small font-semibold text-foreground">EP</span>} title="Estera P." sub="Vocals" chevron />
          </div>
          <div className="material-base flex flex-col overflow-hidden rounded-card">
            <ListRow size="compact" weight="regular" onClick={() => {}} leading={<User className="size-5" strokeWidth={1.8} />} title="Account" chevron />
            <ListRow size="compact" weight="regular" onClick={() => {}} leading={<Settings className="size-5" strokeWidth={1.8} />} title="Settings" trailing={<span className="text-small text-muted-foreground">Dark</span>} chevron />
            <ListRow size="compact" weight="regular" onClick={() => {}} leading={<Moon className="size-5" strokeWidth={1.8} />} title="What's new" trailing={<span className="rounded-full bg-selected px-2 py-0.5 text-caption font-semibold text-link">New</span>} chevron />
            <ListRow size="compact" weight="regular" onClick={() => {}} leading={<ExternalLink className="size-5" strokeWidth={1.8} />} title="Sign out" danger />
          </div>
        </Section>

        <Section title="Toasts: A · Sileo" note="Pick where they appear, then tap a message. Tap the toast to open it. The update pill alone stays at the top on phones.">
          <div className="flex gap-2">
            {['bottom-right', 'top-center'].map((p) => (
              <button key={p} type="button" onClick={() => { sileo.clear(); setToastPos(p); }}
                className={`h-9 rounded-full border px-3 text-small font-medium ${toastPos === p ? 'border-link bg-selected text-foreground' : 'border-input bg-transparent text-muted-foreground'}`}>
                {p === 'bottom-right' ? 'Bottom right' : 'Top centre'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TOASTS.map((t) => (
              <button key={t.title} type="button" onClick={() => {
                const fill = t.danger ? '#B4413A' : theme === 'light' ? '#1C1A17' : '#2A2724';
                sileo[t.kind]({
                  title: t.title, description: t.description, fill, position: toastPos,
                  styles: {
                    title: '!text-[#F3EFE8] !normal-case !font-semibold',
                    description: t.danger ? '!text-white/85' : '!text-[#C9C2B8]',
                    badge: t.danger ? '!bg-white/20 !text-white' : undefined,
                    button: t.danger ? '!bg-white !text-[#8A2F27] !font-semibold' : undefined,
                  },
                  ...(t.button ? { button: { title: t.button, onClick: () => {} } } : {}),
                });
              }} className="h-10 rounded-control border border-input bg-transparent px-3 text-small font-medium text-foreground">
                {t.title}
              </button>
            ))}
          </div>
          {/* Below 1024px the nav pill is at the bottom, so toasts sit above it. */}
          <Toaster position={toastPos} offset={{ bottom: window.matchMedia('(min-width: 1024px)').matches ? 12 : 'calc(88px + env(safe-area-inset-bottom, 0px))', top: 12, right: 12 }} />
        </Section>

        <Section title="Toasts: B · Bencho stack" note="Messages pile up as a stack; tap to fan them out, × closes one, Retry fixes in place.">
          <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-card border border-border bg-background p-6">
            <ToastStack />
          </div>
        </Section>

        <Section title="Colours">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {COLOURS.map((c) => (
              <div key={c} className="flex flex-col gap-1.5">
                <div className="h-12 rounded-control border border-border" style={{ background: `var(--${c})` }} />
                <span className="font-mono text-caption text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
