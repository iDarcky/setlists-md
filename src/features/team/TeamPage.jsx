import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/shadcn/button';
import { Avatar } from '@/app/AppTopBar';
import { BackIcon, ChevronRightIcon, EditIcon, PinIcon } from '@/app/navIcons';
import { displayTokens } from '@/data/instruments';
import { joinPartLabel } from '@/lib/joinLink';
import { ROLE_GROUPS, groupOf, memberName } from '@/lib/teamPeople';

// The Team page (canvas → "Team, church and song usage"). Everyone sees the
// church and everyone in it, grouped by role. Leaders also get the people
// waiting to join (only when there are some), Song usage, and the invite link
// lower down. Pure view: TeamScreen feeds it.

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map(p => <path key={p} d={p} />)}
  </svg>
);
const ICONS = {
  globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z'],
  calendar: ['M4 5h16v16H4z', 'M16 3v4', 'M8 3v4', 'M4 10h16'],
  licence: ['M5 3h14v18H5z', 'M9 7h6', 'M9 11h6', 'M9 15h3'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  qr: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M20 20h1v1h-1z'],
};

export function ChurchMark({ name, url, size = 48 }) {
  if (url) return <img src={url} alt="" className="shrink-0 rounded-card object-cover" style={{ width: size, height: size }} />;
  const initials = String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'C';
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-card bg-raised font-semibold text-foreground" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {initials}
    </span>
  );
}

const SectionTitle = ({ children, count, action }) => (
  <div className="flex items-center justify-between gap-3 pt-3">
    <h2 className="m-0 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}{count != null && <span className="font-medium normal-case tracking-normal">{count}</span>}
    </h2>
    {action}
  </div>
);

/** Logo, name, city and the facts. Owner gets Edit. */
export function ChurchCard({ team, peopleCount, services = [], onEdit }) {
  const facts = [
    services.length > 0 && { d: ICONS.calendar, text: services.join(' · '), label: 'Services' },
    team.address && { d: null, text: team.address, label: 'Address' },
    team.website && { d: ICONS.globe, text: team.website.replace(/^https?:\/\//, ''), href: /^https?:\/\//.test(team.website) ? team.website : `https://${team.website}`, label: 'Website' },
    team.ccli_licence && { d: ICONS.licence, text: `CCLI ${team.ccli_licence}`, label: 'Licence number' },
  ].filter(Boolean);
  return (
    <section aria-label="Church info" className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3.5">
        <ChurchMark name={team.name} url={team.logo_url} size={52} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="m-0 truncate text-[22px] font-semibold leading-7 tracking-[-0.4px]">{team.name}</h1>
          <span className="truncate text-[14px] text-muted-foreground">
            {[team.location, `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`].filter(Boolean).join(' · ')}
          </span>
        </div>
        {onEdit && <Button variant="outline" size="sm" onClick={onEdit}><EditIcon size={16} />Edit</Button>}
      </div>
      {facts.length > 0 && (
        <dl className="m-0 flex flex-col gap-2.5 border-t border-border pt-4">
          {facts.map(f => (
            <div key={f.label} className="flex items-start gap-3 text-[14px] leading-5">
              <span className="mt-0.5 text-muted-foreground">{f.d ? <Icon d={f.d} /> : <PinIcon size={16} />}</span>
              <div className="flex min-w-0 flex-col">
                <dd className="m-0 break-words text-foreground">
                  {f.href ? <a href={f.href} target="_blank" rel="noreferrer" className="text-link no-underline hover:underline">{f.text}</a> : f.text}
                </dd>
                <dt className="text-[12px] text-muted-foreground">{f.label}</dt>
              </div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function PersonRow({ member, sub, onOpen, me = false }) {
  const name = memberName(member);
  return (
    <button type="button" onClick={() => onOpen?.(member)}
      className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent py-2 text-left font-sans text-foreground outline-none first:border-t-0 hover:bg-raised/50 focus-visible:ring-2 focus-visible:ring-ring">
      <Avatar name={name} url={member.profile?.avatar_url} size={36} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-medium">{name}{me && <span className="font-normal text-muted-foreground"> (you)</span>}</span>
        {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
      </span>
      <span className="text-muted-foreground"><ChevronRightIcon /></span>
    </button>
  );
}

const partsLine = (m) => displayTokens(m.instruments).map(t => t.label).join(', ');

/** Everyone, by role. */
export function People({ members = [], ownerId, meId, onOpen }) {
  return ROLE_GROUPS.map(g => {
    const list = members
      .filter(m => groupOf(m.role) === g.id)
      .sort((a, b) => (b.user_id === ownerId) - (a.user_id === ownerId) || memberName(a).localeCompare(memberName(b)));
    if (!list.length) return null;
    return (
      <section key={g.id} aria-label={g.label} className="flex flex-col">
        <SectionTitle count={list.length}>{g.label}</SectionTitle>
        <div className="mt-1 flex flex-col">
          {list.map(m => {
            const tags = [partsLine(m), m.user_id === ownerId ? 'Owner' : '', g.id === 'editor' && !partsLine(m) ? 'Edits songs' : ''].filter(Boolean);
            return <PersonRow key={m.id} member={m} me={m.user_id === meId} sub={tags.join(' · ')} onOpen={onOpen} />;
          })}
        </div>
      </section>
    );
  });
}

const ago = (iso, now = Date.now()) => {
  if (!iso) return '';
  const h = Math.round((now - new Date(iso).getTime()) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h} h ago`;
  if (h < 48) return 'yesterday';
  return `${Math.round(h / 24)} days ago`;
};

/** People who used the join link. Shown only when there are some. */
export function Waiting({ requests = [], onApprove, onDecline, onApproveAll, busy = null, message = null }) {
  if (!requests.length) return null;
  return (
    <section aria-label="Waiting to join" className="flex flex-col gap-1 rounded-card bg-warning/12 px-4 pb-2 pt-1">
      <SectionTitle count={requests.length}
        action={requests.length > 1 && <Button variant="link" className="text-[14px]" disabled={!!busy} onClick={onApproveAll}>Let everyone in</Button>}>
        Waiting for you
      </SectionTitle>
      {requests.map(r => {
        const name = r.display_name || r.email?.split('@')[0] || 'Someone';
        const parts = (r.parts || []).map(joinPartLabel).join(', ');
        return (
          <div key={r.id} className="flex min-h-14 items-center gap-3 border-t border-border/60 py-2 first:border-t-0">
            <Avatar name={name} url={r.avatar_url} size={36} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-medium">{name}</span>
              <span className="truncate text-[13px] text-muted-foreground">{[parts, `asked ${ago(r.created_at)}`].filter(Boolean).join(' · ')}</span>
            </span>
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => onDecline(r)}>No</Button>
            <Button size="sm" loading={busy === r.id} disabled={!!busy} onClick={() => onApprove(r)}>Let in</Button>
          </div>
        );
      })}
      {message && <p className={cn('m-0 pb-1 text-[13px]', message.kind === 'error' ? 'text-danger' : 'text-muted-foreground')}>{message.text}</p>}
    </section>
  );
}

/** The row that opens Song usage (leaders). */
export function UsageEntry({ summary, onOpen }) {
  return (
    <button type="button" onClick={onOpen}
      className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-card border border-border bg-card px-4 py-3 text-left font-sans text-foreground outline-none hover:bg-raised/50 focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-raised"><Icon d={ICONS.chart} size={18} /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">Song usage</span>
        <span className="truncate text-[13px] text-muted-foreground">{summary || 'What we played, when, and who planned it'}</span>
      </span>
      <span className="text-muted-foreground"><ChevronRightIcon /></span>
    </button>
  );
}

/** The join link: Copy, Send…, QR, on/off and reset live under "More". */
export function InviteCard({ teamName, url, enabled = true, loading = false, error = null, onToggle, onReset, busy = null }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const canSend = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!url || !showQr) return undefined;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then(d => { if (!cancelled) setQr(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [url, showQr]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked: the link is selectable */ }
  };
  const send = async () => {
    try { await navigator.share({ title: `Join ${teamName}`, text: `Join ${teamName} on Setlists.md`, url }); } catch { /* dismissed */ }
  };

  return (
    <section aria-label="Invite people" className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[17px] font-semibold">Invite people</h2>
        <p className="m-0 text-[14px] leading-5 text-muted-foreground">Anyone with the link can ask to join. You let them in.</p>
      </div>
      {loading && <p className="m-0 text-[14px] text-muted-foreground">One moment…</p>}
      {error && !url && <p className="m-0 text-[14px] text-danger">{error}</p>}
      {url && (
        <>
          <div className={cn('truncate rounded-control border border-input bg-raised px-3.5 py-3 font-mono text-[14px]', !enabled && 'opacity-50')} title={url}>
            {url.replace(/^https?:\/\//, '')}
          </div>
          {!enabled && <p className="m-0 text-[14px] text-muted-foreground">The link is off. Nobody can ask to join with it.</p>}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!enabled} onClick={copy}><Icon d={ICONS.copy} />{copied ? 'Copied' : 'Copy'}</Button>
            {canSend && <Button className="flex-1" variant="outline" disabled={!enabled} onClick={send}><Icon d={ICONS.send} />Send…</Button>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-[14px]">
            <Button variant="link" disabled={!enabled} onClick={() => setShowQr(v => !v)}>{showQr ? 'Hide QR code' : 'QR code'}</Button>
            {onToggle && <Button variant="link" disabled={busy === 'toggle'} onClick={() => onToggle(!enabled)}>{enabled ? 'Turn the link off' : 'Turn the link on'}</Button>}
            {onReset && <Button variant="link" className="text-danger" disabled={!!busy} onClick={onReset}>New link</Button>}
          </div>
          {showQr && enabled && qr && (
            <div className="flex flex-col items-center gap-2 pt-1">
              <img src={qr} alt={`QR code for the ${teamName} join link`} width="200" height="200" className="rounded-control bg-white p-2" />
              <span className="text-[13px] text-muted-foreground">Put it on the screen at rehearsal. Phones can scan it.</span>
            </div>
          )}
          {error && <p className="m-0 text-[14px] text-danger">{error}</p>}
        </>
      )}
    </section>
  );
}

/** The whole page. */
export default function TeamPage({
  team, members = [], meId, isOwner = false, services = [],
  waiting = null, usage = null, invite = null,
  onBack, backLabel = 'Back', onEditChurch, onOpenPerson, footer = null,
}) {
  return (
    <div data-slot="team-page" className="@container min-h-full bg-background font-sans text-foreground">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col px-4 pb-32 @min-[640px]:px-6 @min-[1024px]:pb-12">
        <div className="flex h-14 items-center @min-[640px]:mt-4" style={{ marginTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>
          {onBack && (
            <button type="button" onClick={onBack} className="-ml-2 flex h-11 min-h-0 cursor-pointer items-center gap-1.5 rounded-control border-0 bg-transparent pl-2 pr-3 font-sans text-[15px] font-medium text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <BackIcon />{backLabel}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4 @min-[1024px]:grid @min-[1024px]:grid-cols-[minmax(0,1fr)_400px] @min-[1024px]:items-start @min-[1024px]:gap-x-10">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="@min-[1024px]:hidden"><ChurchCard team={team} peopleCount={members.length} services={services} onEdit={isOwner ? onEditChurch : undefined} /></div>
            {waiting}
            {usage && <div className="@min-[1024px]:hidden">{usage}</div>}
            <div className="flex flex-col"><People members={members} ownerId={team.owner_id} meId={meId} onOpen={onOpenPerson} /></div>
            {invite && <div className="@min-[1024px]:hidden">{invite}</div>}
            <div className="@min-[1024px]:hidden">{footer}</div>
          </div>
          <aside className="hidden flex-col gap-4 @min-[1024px]:flex">
            <ChurchCard team={team} peopleCount={members.length} services={services} onEdit={isOwner ? onEditChurch : undefined} />
            {usage}
            {invite}
            {footer}
          </aside>
        </div>
      </div>
    </div>
  );
}
