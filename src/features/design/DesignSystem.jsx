import { lazy, Suspense, useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Alert } from '@/ui/shadcn/alert';
import { Badge } from '@/ui/shadcn/badge';
import { Card, CardLabel } from '@/ui/shadcn/card';
import { Toggle } from '@/ui/shadcn/toggle';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/ui/shadcn/field';
import { cn } from '@/ui/shadcn/utils';
import LegalSheet from '@/features/legal/LegalSheet';
import { WelcomeView, CreateAccountView, LogInView, ForgotPasswordView } from '@/features/auth/AuthViews';
import {
  JoinInviteView, AboutYouView, WaitingView, YoureInView, DeclinedView, BadLinkView,
} from '@/features/join/JoinViews';

import { AppTopBar } from '@/app/AppTopBar';
import { NavPill } from '@/app/NavPill';
import YouPage from '@/features/you/YouPage';
import HomeView from '@/features/home/HomeView';
import ScheduleView from '@/features/schedule/ScheduleView';
import SongsView from '@/features/songs/SongsView';
import { playStats, nextSetlistSongs, playLine, sortSongs, filterSongs, filterOptions, songKey, NO_FILTERS } from '@/lib/songsData';
import AvailabilitySheet from '@/features/schedule/AvailabilitySheet';
import { groupByMonth, myStatus, bandSummary, needsPeople, isDraft } from '@/lib/scheduleData';
import { myAsks, myServices, twoWeeks, whoCanPlay, needsYou, recentActivity } from '@/lib/homeData';

const LydianShowcase = lazy(() => import('./LydianShowcase'));

// /design — the design system, built from the real components. Every swatch,
// size and screen here is rendered by the code the app runs, so this page and
// the app cannot drift apart. The approved mockups live on the canvas
// "Signed out and joining" (Version 2 · warm black + Geist).

const THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
];

const ROLES = [
  ['background', 'Page'],
  ['card', 'Card, sheet'],
  ['raised', 'Raised, hover'],
  ['border', 'Hairline'],
  ['input', 'Field edge'],
  ['muted-foreground', 'Quiet text'],
  ['foreground', 'Text'],
  ['primary', 'Main button'],
  ['link', 'Link, accent'],
  ['selected', 'Picked fill'],
];

const SEMANTIC = [
  ['danger', 'Red · errors, remove'],
  ['warning', 'Amber · maybe, warnings'],
  ['success', 'Green · available, saved'],
  ['info', 'Blue · tips'],
];

const GREEN_RAMP = [
  ['0', '#F9FBFA'], ['0.5', '#E8EEEC'], ['1', '#D8E1DE'], ['1.5', '#C7D4D0'], ['2', '#B7C7C2'],
  ['3', '#95ADA7'], ['4', '#74938B'], ['5', '#53796F'], ['6', '#426159'], ['7', '#324943'],
  ['8', '#21302C'], ['8.5', '#192421'], ['9', '#111816'], ['9.5', '#080C0B'],
];

const CHURCH = { name: 'Grace Church', logoUrl: null, initials: 'GC' };
const noop = () => {};

function Section({ title, sub, children }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-title">{title}</h2>
        {sub && <p className="m-0 text-small text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/** The same content once per theme, side by side. */
function BothThemes({ children, className }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {THEMES.map(t => (
        <div key={t.id} data-theme={t.id} className={cn('flex flex-col gap-4 rounded-card border border-border bg-background p-5 text-foreground', className)}>
          <span className="text-caption font-medium text-muted-foreground">{t.label}</span>
          {children}
        </div>
      ))}
    </div>
  );
}

function Swatch({ token, label }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-control border border-border" style={{ background: `var(--${token})` }} />
      <div className="flex min-w-0 flex-col">
        <span className="text-small font-medium">{label}</span>
        <span className="font-mono text-[12px] text-muted-foreground">{token}</span>
      </div>
    </div>
  );
}

function ChipsDemo() {
  const [picked, setPicked] = useState(['vocals', 'keys']);
  const parts = [['vocals', 'Vocals'], ['acoustic', 'Acoustic guitar'], ['bass', 'Bass'], ['keys', 'Keys'], ['drums', 'Drums']];
  return (
    <div className="flex flex-wrap gap-2">
      {parts.map(([id, label]) => (
        <Toggle key={id} pressed={picked.includes(id)} onPressedChange={() => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))}>
          {label}
        </Toggle>
      ))}
    </div>
  );
}

// ── Navigation ──────────────────────────────────────────────────────────────

const ME = { name: 'Joe Doe', email: 'joe@example.com' };

function NavDemo({ theme }) {
  const [active, setActive] = useState('home');
  return (
    <div className="flex flex-col gap-4">
      <Frame theme={theme} width={390} height={300} scale={0.8} label={`Phone · ${theme}`}>
        <div className="absolute inset-0 bg-background text-foreground">
          <AppTopBar layout="compact" church={CHURCH} onOpenChurches={noop} unread onOpenNotifications={noop} me={ME} meBadge={1} onOpenYou={noop} add={{ label: 'New song', onClick: noop }} />
          <NavPill embedded active={active} onSelect={setActive} />
        </div>
      </Frame>
      <div data-theme={theme} className="overflow-x-auto rounded-card border border-border bg-background text-foreground [&>header]:min-w-[640px]">
        <AppTopBar
          layout="wide"
          church={CHURCH} unread onOpenNotifications={noop} me={ME} onOpenYou={noop}
          add={{ label: 'New song', onClick: noop }}
          pill={<NavPill placement="top" active={active} onSelect={setActive} />}
        />
      </div>
    </div>
  );
}

function NavGallery() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6">
        {THEMES.map(t => <NavDemo key={t.id} theme={t.id} />)}
      </div>
      <div className="flex flex-wrap gap-6">
        {THEMES.map(t => (
          <Frame key={t.id} theme={t.id} width={390} height={844} scale={0.6} label={`You · ${t.label}`}>
            <YouPage
              embedded me={ME} church={CHURCH} teamBadge={1} theme={t.id}
              onBack={noop} onProfile={noop} onTeam={noop} onSettings={noop} onThemeChange={noop}
              onHelp={noop} onWhatsNew={noop} onInstall={noop} onDesign={noop} onSignOut={noop}
            />
          </Frame>
        ))}
      </div>
    </div>
  );
}

// ── Home ────────────────────────────────────────────────────────────────────

// Sample church: today is Sunday 25 October 2026. Joe plays keys on 1 Nov and
// has three asks; the leader view adds join requests and empty services.
const H_NOW = new Date(2026, 9, 25, 9, 0).getTime();
const hs = (id, name, date, time, extra = {}) => ({ id, name, date, time, location: 'Main hall', items: [{ songId: 'x' }], status: 'ready', ...extra });
const H_SETLISTS = [
  hs('s1', 'Sunday Morning', '2026-11-01', '10:00', { rehearsalDate: '2026-10-31', rehearsalTime: '18:00', status: 'draft' }),
  hs('s2', 'Youth Night', '2026-11-06', '19:00', { items: [] }),
  hs('s3', 'Sunday Morning', '2026-11-08', '10:00'),
  hs('s4', 'Sunday Morning', '2026-11-22', '10:00'),
];
const H_SCHEDULES = [
  { id: 'k1', user_id: 'joe', setlist_id: 's1', availability: 'available', role: 'Keys' },
  { id: 'k2', user_id: 'joe', setlist_id: 's2', availability: 'pending', role: 'Keys' },
  { id: 'k3', user_id: 'joe', setlist_id: 's3', availability: 'pending', role: 'Keys' },
  { id: 'k4', user_id: 'joe', setlist_id: 's4', availability: 'pending', role: 'Vocals' },
  ...['am', 'rk', 'ls'].map((u, i) => ({ id: `b${i}`, user_id: u, setlist_id: 's1', availability: 'available' })),
  { id: 'b9', user_id: 'tp', setlist_id: 's1', availability: 'pending' },
];
const hAgo = h => new Date(H_NOW - h * 3600000).toISOString();
const H_ACTIVITY = recentActivity([
  { id: 1, action: 'song_edited', entity_id: 'h', entity_name: 'Holy Forever', actor_id: 'am', created_at: hAgo(2) },
  { id: 2, action: 'setlist_created', entity_id: 's2', entity_name: 'Youth Night', actor_id: 'joe', created_at: hAgo(5) },
  { id: 3, action: 'song_added', entity_id: 'f', entity_name: 'Firm Foundation', actor_id: 'rk', created_at: hAgo(26) },
  { id: 4, action: 'song_removed', entity_id: 'o', entity_name: 'Oceans', actor_id: 'am', created_at: hAgo(50) },
  { id: 5, action: 'member_joined', entity_id: 'tp', actor_id: 'tp', created_at: hAgo(80) },
], { nameFor: id => ({ am: 'Ana M', rk: 'Rob K', tp: 'Tim P' })[id], userId: 'joe' });

function HomeDemo({ leader = false, empty = false, layout }) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState('2026-11-01');
  const asks = empty ? [] : myAsks({ schedules: H_SCHEDULES, userId: 'joe', setlists: H_SETLISTS, now: H_NOW });
  const plays = empty ? [] : myServices({ schedules: H_SCHEDULES, userId: 'joe', setlists: H_SETLISTS, now: H_NOW });
  const days = twoWeeks({ now: H_NOW, offset, setlists: empty ? [] : H_SETLISTS, plays, asks });
  const band = [['Joe Doe', true], ['Ana M', true], ['Rob K', true], ['Lia S', true], ['Tim P', false]].map(([name, yes], i) => ({ id: i, name, yes }));
  const ask = leader ? asks.slice(0, 1) : asks;
  return (
    <HomeView
      layout={layout}
      name="Joe"
      dateLabel="Sunday, 25 October"
      sync={{ state: 'ok', label: 'Up to date' }}
      leader={leader}
      needs={leader ? needsYou({ joinRequests: [{ display_name: 'Ana M.' }, { display_name: 'Tim P.' }], setlists: H_SETLISTS, schedules: H_SCHEDULES.filter(r => r.setlist_id !== 's3'), now: H_NOW }) : []}
      asks={ask}
      onAnswer={noop}
      next={empty ? null : { setlist: H_SETLISTS[0], part: leader ? null : 'Keys', band, days: 7 }}
      onOpenSetlist={noop}
      onMarkReady={noop}
      strip={{ days, offset, onOffset: setOffset, selected: picked, onSelect: setPicked }}
      whoCanPlay={leader ? whoCanPlay({ setlists: H_SETLISTS, availability: [
        ...Array(6).fill({ date: '2026-11-01', status: 'available' }), { date: '2026-11-01', status: 'maybe' }, { date: '2026-11-01', status: 'unavailable' },
        ...Array(3).fill({ date: '2026-11-06', status: 'available' }), ...Array(2).fill({ date: '2026-11-06', status: 'maybe' }),
        ...Array(2).fill({ date: '2026-11-08', status: 'available' }), { date: '2026-11-08', status: 'unavailable' },
      ], memberCount: 10, now: H_NOW }) : null}
      onOpenSchedule={noop}
      setup={empty ? [
        { id: 'join', label: 'Join Grace Church', done: true },
        { id: 'install', label: 'Put the app on your home screen', done: false, onClick: noop },
        { id: 'push', label: 'Turn on notifications', hint: 'So you hear when you are asked to play', done: false, onClick: noop },
      ] : null}
      activity={H_ACTIVITY}
      now={H_NOW}
      onOpenActivity={noop}
      onOpenSongs={noop}
      showNothingPlanned={empty}
      embedded
    />
  );
}

function HomeGallery() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-6">
        {[['Member', {}], ['Leader', { leader: true }], ['New member', { empty: true }]].map(([label, props]) => THEMES.map(t => (
          <Frame key={label + t.id} theme={t.id} width={390} height={1760} scale={0.6} label={`${label} · ${t.label}`}>
            <HomeDemo layout="phone" {...props} />
          </Frame>
        )))}
      </div>
      <Frame theme="dark" width={1200} height={1100} scale={0.8} label="Desktop · leader">
        <HomeDemo layout="wide" leader />
      </Frame>
    </div>
  );
}

// ── Schedule ────────────────────────────────────────────────────────────────

const S_NAMES = { joe: 'Joe Doe', am: 'Ana M', rk: 'Rob K', ls: 'Lia S', tp: 'Tim P' };
const S_SETLISTS = [
  ...H_SETLISTS,
  hs('s5', 'Sunday Morning', '2026-12-06', '10:00'),
  hs('p1', 'Sunday Morning', '2026-10-18', '10:00'),
  hs('p2', 'Youth Night', '2026-10-16', '19:00'),
];
const S_SCHEDULES = [...H_SCHEDULES, { id: 'k9', user_id: 'joe', setlist_id: 'p1', availability: 'available', role: 'Keys' }];
const S_AVAIL = [{ user_id: 'joe', date: '2026-12-06', status: 'unavailable' }, { user_id: 'rk', date: '2026-11-08', status: 'available' }, { user_id: 'mv', date: '2026-11-08', status: 'available' }];

function ScheduleDemo({ leader = false, layout }) {
  const [tab, setTab] = useState('upcoming');
  const [filter, setFilter] = useState('all');
  const [sheet, setSheet] = useState(false);
  const [mine, setMine] = useState({ '2026-11-01': 'available', '2026-12-06': 'unavailable', '2026-11-20': 'maybe' });
  const ctx = { schedules: S_SCHEDULES, userId: 'joe', availability: S_AVAIL };
  const rowFor = (sl) => {
    const summary = bandSummary(sl, ctx);
    return { setlist: sl, me: myStatus(sl, ctx), summary, songCount: (sl.items || []).filter(i => i.songId).length * 5,
      faces: summary.rows.map(r => ({ id: r.id, name: S_NAMES[r.user_id] || 'Member', yes: r.availability === 'available' })) };
  };
  const all = groupByMonth(S_SETLISTS, { now: H_NOW, past: tab === 'past' });
  const keep = (r) => !leader || tab === 'past' || filter === 'all' || (filter === 'needs' ? needsPeople(r.summary) : isDraft(r.setlist));
  const groups = all.map(g => ({ month: g.month, rows: g.setlists.map(rowFor).filter(keep) })).filter(g => g.rows.length);
  const up = all.flatMap(g => g.setlists.map(rowFor));
  return (
    <>
      <ScheduleView
        layout={layout} embedded leader={leader} tab={tab} onTab={setTab} filter={filter} onFilter={setFilter} showBand={leader}
        counts={{ needs: up.filter(r => needsPeople(r.summary)).length, drafts: up.filter(r => isDraft(r.setlist)).length }}
        groups={groups} onOpen={noop} onAnswer={noop} onNew={leader ? noop : null} onAvailability={() => setSheet(true)}
      />
      <AvailabilitySheet
        open={sheet} onOpenChange={setSheet} mine={mine} busyDates={new Set(S_SETLISTS.map(s => s.date))} now={H_NOW}
        onSet={(d, st) => setMine(m => ({ ...m, [d]: st }))} onClear={(d) => setMine(({ [d]: _, ...rest }) => rest)}
      />
    </>
  );
}

function ScheduleGallery() {
  return (
    <div className="flex flex-wrap gap-6">
      {[['Member', {}], ['Leader', { leader: true }]].map(([label, props]) => THEMES.map(t => (
        <Frame key={label + t.id} theme={t.id} width={390} height={1000} scale={0.6} label={`${label} · ${t.label}`}>
          <ScheduleDemo layout="phone" {...props} />
        </Frame>
      )))}
    </div>
  );
}

// ── Songs ───────────────────────────────────────────────────────────────────

const so = (id, title, artist, key, tempo, themes) => ({ id, title, artist, themes, arrangements: [{ id: `${id}a`, key, tempo }] });
const SO_SONGS = [
  so('ag', 'Amazing Grace (My Chains Are Gone)', 'Chris Tomlin', 'G', 70, 'Grace, Cross'),
  so('bl', 'Build My Life', 'Housefires', 'G', 68, 'Praise'),
  so('ff', 'Firm Foundation', 'Cody Carnes', 'C', 76, 'Hope'),
  so('gg', 'Goodness of God', 'Bethel Music', 'A', 63, 'Praise, Grace'),
  so('gi', 'Graves Into Gardens', 'Elevation Worship', 'B', 70, 'Hope'),
  so('hf', 'Holy Forever', 'Chris Tomlin', 'A', 72, 'Praise'),
  so('lh', 'Living Hope', 'Phil Wickham', 'D', 72, 'Hope, Cross'),
  so('lp', 'Laudă-L pe Domnul', 'Worship RO', 'E', 120, 'Praise'),
  so('wm', 'Way Maker', 'Sinach', 'E', 68, 'Praise'),
];
const soSet = (date, ids) => ({ id: `so-${date}`, date, time: '10:00', items: ids.map(songId => ({ songId })) });
const SO_SETLISTS = [
  soSet('2026-10-25', ['wm', 'gg']), soSet('2026-10-18', ['bl', 'wm', 'gg']), soSet('2026-10-11', ['hf', 'wm']),
  soSet('2026-10-04', ['lh', 'gg']), soSet('2026-09-27', ['lp', 'wm']), soSet('2026-08-09', ['ag', 'bl']), soSet('2026-05-24', ['gi']),
  soSet('2026-11-01', ['bl', 'gg', 'hf', 'lh', 'wm', 'ff']),
];

function SongsDemo({ leader = true, empty = false, layout }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('az');
  const [filters, setFilters] = useState(NO_FILTERS);
  const songs = empty ? [] : SO_SONGS;
  const now = H_NOW + 3600000 * 8;
  const stats = playStats(SO_SETLISTS, now);
  const next = nextSetlistSongs(SO_SETLISTS, now);
  const found = query ? songs.filter(s => s.title.toLowerCase().includes(query.toLowerCase())) : sortSongs(songs, sort, stats);
  const rows = filterSongs(found, filters, stats, now).map(song => ({ song, keyName: songKey(song), line: playLine(stats[song.id], now), next: next.ids.has(song.id) }));
  return (
    <SongsView
      layout={layout} embedded leader={leader} total={songs.length} rows={rows} nextLabel={next.label}
      query={query} onQuery={setQuery} sort={sort} onSort={setSort} filters={filters} onFilters={setFilters}
      options={filterOptions(songs)} onOpen={noop} onAdd={noop} onTag={noop} onDelete={noop} onCopy={noop} onMove={noop}
    />
  );
}

function SongsGallery() {
  return (
    <div className="flex flex-wrap gap-6">
      {[['Leader', {}], ['Member', { leader: false }], ['Empty', { empty: true }]].map(([label, props]) => THEMES.map(t => (
        <Frame key={label + t.id} theme={t.id} width={390} height={label === 'Empty' ? 600 : 1000} scale={0.6} label={`${label} · ${t.label}`}>
          <SongsDemo layout="phone" {...props} />
        </Frame>
      )))}
    </div>
  );
}

// ── Screen gallery ──────────────────────────────────────────────────────────

function Frame({ theme, width, height, scale = 1, label, children }) {
  return (
    <figure className="m-0 flex shrink-0 flex-col gap-2">
      <div style={{ width: width * scale, height: height * scale }}>
        <div
          data-theme={theme}
          className="relative origin-top-left overflow-hidden rounded-[32px] border border-border"
          style={{ width, height, transform: scale === 1 ? undefined : `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
      <figcaption className="text-caption text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

function AboutYouDemo(props) {
  const [name, setName] = useState('Joe Doe');
  const [parts, setParts] = useState(['vocals', 'keys']);
  return <AboutYouView church={CHURCH} name={name} onNameChange={setName} parts={parts} onPartsChange={setParts} onSubmit={noop} onNotNow={noop} {...props} />;
}

const FILLED = { name: 'Joe Doe', email: 'joe@example.com', password: 'password1', confirm: 'password1' };

const SCREENS = [
  ['Welcome', () => <WelcomeView embedded onCreateAccount={noop} onLogIn={noop} />],
  ['Create account', () => <CreateAccountView embedded values={FILLED} onChange={noop} onSubmit={noop} onBack={noop} onLogIn={noop} onShowLegal={noop} />],
  ['Log in', () => <LogInView embedded values={FILLED} onChange={noop} onSubmit={noop} onBack={noop} onForgot={noop} onCreateAccount={noop} />],
  ['Forgot password', () => <ForgotPasswordView embedded email="" onChange={noop} onSubmit={noop} onBack={noop} />],
  ['Join: invite', () => <JoinInviteView embedded church={CHURCH} alreadyIn="Daniel and 11 others are already in" onCreateAccount={noop} onLogIn={noop} onNotNow={noop} />],
  ['Join: log in', () => <LogInView embedded joining={CHURCH} values={FILLED} onChange={noop} onSubmit={noop} onBack={noop} onForgot={noop} onCreateAccount={noop} />],
  ['Join: about you', () => <AboutYouDemo embedded />],
  ['Join: waiting', () => <WaitingView embedded church={CHURCH} name="Joe Doe" parts={['vocals', 'keys']} onSignOut={noop} />],
  ['Join: you’re in', () => (
    <YoureInView
      embedded
      church={CHURCH}
      steps={[
        { title: 'Put the app on your phone', body: 'Opens full screen, like a real app.', action: { label: 'Show me how', onClick: noop } },
        { title: 'Turn on alerts', body: 'Hear when a leader asks you to play.', action: { label: 'Turn on', onClick: noop } },
        { title: 'Say which dates you can play', body: 'So leaders know who’s free.', action: { label: 'Open the schedule', onClick: noop, primary: true } },
      ]}
      onSkip={noop}
    />
  )],
  ['Join: not approved', () => <DeclinedView embedded church={CHURCH} onOpenApp={noop} onSignOut={noop} />],
  ['Join: link doesn’t work', () => <BadLinkView embedded onOpenApp={noop} />],
];

function Gallery() {
  return (
    <div className="flex flex-col gap-8">
      {SCREENS.map(([label, render]) => (
        <div key={label} className="flex flex-col gap-2">
          <h3 className="m-0 text-body font-semibold">{label}</h3>
          <div className="flex gap-6 overflow-x-auto pb-2">
            {THEMES.map(t => (
              <Frame key={t.id} theme={t.id} width={390} height={844} scale={0.75} label={t.label}>{render()}</Frame>
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <h3 className="m-0 text-body font-semibold">iPad and desktop</h3>
        <div className="flex items-start gap-6 overflow-x-auto pb-2">
          <Frame theme="dark" width={820} height={1180} scale={0.5} label="iPad: log in">
            <LogInView embedded values={FILLED} onChange={noop} onSubmit={noop} onBack={noop} onForgot={noop} onCreateAccount={noop} />
          </Frame>
          <Frame theme="light" width={1280} height={800} scale={0.5} label="Desktop: about you">
            <AboutYouDemo embedded />
          </Frame>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

/** /design?screen=<n>&theme=light — one screen alone, full window (screenshots). */
function soloScreen() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (!q.has('screen')) return null;
    const entry = SCREENS[Number(q.get('screen'))];
    return entry ? { render: entry[1], theme: q.get('theme') === 'light' ? 'light' : 'dark' } : null;
  } catch { return null; }
}

export default function DesignSystem({ onBack }) {
  const [legacy, setLegacy] = useState(false);
  const [legal, setLegal] = useState(null);
  const [solo] = useState(soloScreen);

  if (solo) {
    return <div data-theme={solo.theme} className="fixed inset-0 z-[60]">{solo.render()}</div>;
  }

  if (legacy) {
    return (
      <Suspense fallback={null}>
        <LydianShowcase onBack={() => setLegacy(false)} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-full bg-background font-sans text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4">
        <img src="/setlists-md-mark.svg" alt="" width="28" height="28" />
        <div className="flex flex-1 flex-col">
          <h1 className="m-0 text-body font-semibold">Setlists.md design system</h1>
          <span className="text-caption text-muted-foreground">Warm black + Geist · shadcn/ui · src/ui/shadcn</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setLegacy(true)}>Old showcase</Button>
        {onBack && <Button size="sm" variant="outline" onClick={onBack}>Back</Button>}
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-14 px-6 py-10">
        <Section title="Colours" sub="Warm neutrals do the work. Green is an accent only. Names match shadcn, so its components fit as they are.">
          <BothThemes>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(([token, label]) => <Swatch key={token} token={token} label={label} />)}
            </div>
          </BothThemes>
        </Section>

        <Section title="Status colours" sub="A fill, a solid and a text step each. Chord gold is unchanged and not part of this set.">
          <BothThemes>
            <div className="flex flex-col gap-2">
              {SEMANTIC.map(([t, label]) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="size-8 rounded-control" style={{ background: `var(--${t}-fill)` }} />
                  <span className="size-8 rounded-control" style={{ background: `var(--${t})` }} />
                  <span className="text-small font-medium" style={{ color: `var(--${t}-text)` }}>{label}</span>
                </div>
              ))}
            </div>
          </BothThemes>
        </Section>

        <Section title="Your green ramp" sub="The logo is step 5. Links use a lighter green on dark and a darker green on light.">
          <div className="grid grid-cols-7 gap-2 md:grid-cols-14">
            {GREEN_RAMP.map(([step, hex]) => (
              <div key={step} className="flex flex-col gap-1">
                <span className="h-12 rounded-control border border-border" style={{ background: hex }} />
                <span className="text-caption font-medium">{step}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{hex}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Text" sub="Geist Sans and Geist Mono, five sizes.">
          <div className="flex flex-col gap-3">
            <span className="text-display">Display 32 · Ready for Sunday</span>
            <span className="text-title">Title 24 · Log in</span>
            <span className="text-body">Body 16 · Chord charts, setlists and who’s playing.</span>
            <span className="text-small text-muted-foreground">Small 14 · At least 8 characters.</span>
            <span className="text-caption font-medium">Caption 13 · Email</span>
            <span className="font-mono text-small text-muted-foreground">Geist Mono · setlists.md · G · 90 BPM</span>
          </div>
        </Section>

        <Section title="Corners and sizes" sub="8 for buttons and fields, 12 for cards, 20 for drawers. Buttons and fields are 48px on a phone, 44px from the iPad up.">
          <div className="flex flex-wrap items-end gap-4">
            {[['rounded-control', '8 · control'], ['rounded-card', '12 · card'], ['rounded-sheet', '20 · sheet']].map(([c, l]) => (
              <div key={c} className="flex flex-col gap-2">
                <span className={cn('block size-20 border border-input bg-raised', c)} />
                <span className="text-caption text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons" sub="Ink first: one per screen, for the thing the screen is for.">
          <BothThemes>
            <div className="flex flex-wrap items-center gap-3">
              <Button>Log in</Button>
              <Button variant="outline">Create account</Button>
              <Button variant="ghost">Not now</Button>
              <Button variant="link">Forgot password?</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Open the schedule</Button>
              <Button size="sm" variant="outline">Show me how</Button>
              <Button loading>Sending</Button>
              <Button disabled>Disabled</Button>
              <Button variant="destructive">Remove</Button>
            </div>
          </BothThemes>
        </Section>

        <Section title="Fields">
          <BothThemes>
            <Field>
              <FieldLabel htmlFor="ds-email">Email</FieldLabel>
              <Input id="ds-email" type="email" placeholder="you@example.com" />
            </Field>
            <Field>
              <FieldLabel htmlFor="ds-pw">Password</FieldLabel>
              <Input id="ds-pw" type="password" defaultValue="short" aria-invalid />
              <FieldDescription>At least 8 characters.</FieldDescription>
              <FieldError>Passwords don’t match.</FieldError>
            </Field>
          </BothThemes>
        </Section>

        <Section title="Chips" sub="Pick all that fit. Picked: soft green fill, green edge, a tick.">
          <BothThemes>
            <ChipsDemo />
            <div className="flex flex-wrap gap-1.5">
              <Badge>Vocals</Badge>
              <Badge variant="outline">Leader</Badge>
              <Badge variant="success">Available</Badge>
              <Badge variant="warning">Maybe</Badge>
              <Badge variant="danger">Can’t</Badge>
              <Badge variant="info">Tip</Badge>
            </div>
          </BothThemes>
        </Section>

        <Section title="Messages and cards">
          <BothThemes>
            <Alert variant="danger">That email and password don’t match.</Alert>
            <Alert variant="success">Sent. Check your email for a link.</Alert>
            <Card>
              <CardLabel>What you sent</CardLabel>
              <span className="text-body font-semibold">Joe Doe</span>
              <div className="flex gap-1.5"><Badge>Vocals</Badge><Badge>Keys</Badge></div>
            </Card>
          </BothThemes>
        </Section>

        <Section title="Drawer and dialog" sub="A bottom drawer on a phone, a centred dialog from the iPad up. Same component.">
          <div><Button variant="outline" onClick={() => setLegal('terms')}>Open the Terms</Button></div>
          <LegalSheet doc={legal} onClose={() => setLegal(null)} />
        </Section>

        <Section title="Home" sub="Asks first, then your next service and your two weeks. Leaders also get Needs you and Who can play. Live components with sample data.">
          <HomeGallery />
        </Section>

        <Section title="Schedule" sub="Every setlist coming up, with where you stand. Leaders see the band and Draft/Ready, and filter what needs people. My availability opens a month to tap through.">
          <ScheduleGallery />
        </Section>

        <Section title="Songs" sub="One list: search, quick chips, the sort, then each song with how often and when it was last played, and its key. Leaders long-press or tap Select to tag, delete, or move/copy to another church they lead.">
          <SongsGallery />
        </Section>

        <Section title="Navigation" sub="One top bar: the church on the left, the bell and you on the right. The pill floats at the bottom on a phone and an iPad held upright, and sits in the top bar from 1024px. You is a page.">
          <NavGallery />
        </Section>

        <Section title="Screens: signed out and joining" sub="The real screens, with sample data. Tap around: they are live components.">
          <Gallery />
        </Section>
      </main>
    </div>
  );
}
