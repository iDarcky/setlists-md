import { useEffect, useState } from 'react';
import PageHeader from '@/ui/PageHeader';
import { Button } from '@/ui/Button';
import { Switch } from '@/ui/Switch';
import { Dialog } from '@/ui/Dialog';
import { useConfirm } from '@/ui/useConfirmHook';
import { useTeam } from '@/auth/useTeam';
import { useTeamServices } from '@/hooks/useTeamServices';
import { INSTRUMENTS, labelFor, normalize } from '@/data/instruments';
import { SERVICE_COLORS, WEEKDAYS, serviceColor, whenLabel, shortTime, memberIdsOf } from '@/lib/services';

// Services — the leader's setup page (20261020_team_services.sql). A list of
// the Space's services; tapping one opens its template (day, time, how far
// ahead people are asked, band parts, a song outline) and the people who play
// in it. Phones show one or the other; from `lg` both sit side by side.

const PART_OPTIONS = [{ id: 'vocals', label: 'Vocals' }, ...INSTRUMENTS.map(i => ({ id: i.id, label: i.label }))];
const NTH_OPTIONS = [
  { value: '', label: 'Every week' },
  { value: '1', label: '1st of the month' },
  { value: '2', label: '2nd of the month' },
  { value: '3', label: '3rd of the month' },
  { value: '4', label: '4th of the month' },
  { value: '5', label: '5th of the month' },
];

const FIELD = 'w-full min-w-0 h-11 px-3 rounded-xl bg-[var(--modes-surface)] border border-[var(--modes-border)] text-copy-14 text-[var(--modes-text)] outline-none focus:border-[var(--modes-text-dim)]';
const LABEL = 'text-label-12 uppercase tracking-wider font-semibold text-[var(--modes-text-dim)]';

function memberName(m) {
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || 'Member';
}

function Dot({ color, size = 10 }) {
  return <span aria-hidden="true" className="rounded-full shrink-0" style={{ width: size, height: size, background: serviceColor(color) }} />;
}

function PersonAvatar({ member, size = 32 }) {
  const name = memberName(member);
  const url = member?.profile?.avatar_url;
  return (
    <span
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center text-label-12 font-semibold bg-[var(--ds-gray-200)] text-[var(--ds-gray-900)]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function ServiceList({ services, serviceMembers, selectedId, onSelect, onNew, canEdit }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
        Each service has its own day, template and people. People only get asked about the services they're on.
      </p>
      {services.length === 0 && (
        <div className="modes-card px-4 py-6 text-center text-copy-14 text-[var(--modes-text-muted)]">
          No services yet. Add the ones your church plays for, like Sunday Morning or Youth Night.
        </div>
      )}
      <div className="flex flex-col gap-2">
        {services.map(s => {
          const on = s.id === selectedId;
          const count = memberIdsOf(s.id, serviceMembers).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={on ? 'true' : undefined}
              className={`modes-card flex items-center gap-3 min-h-[60px] px-4 text-left cursor-pointer transition-colors ${on ? 'ring-1 ring-[var(--color-brand)] bg-[var(--modes-surface-strong)]' : 'hover:bg-[var(--modes-surface-strong)]'}`}
            >
              <Dot color={s.color} />
              <span className="flex-1 min-w-0">
                <span className="block text-copy-15 font-semibold text-[var(--modes-text)] truncate">{s.name}</span>
                <span className="block text-label-13 text-[var(--modes-text-muted)]">{whenLabel(s)} · {count} {count === 1 ? 'person' : 'people'}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--modes-text-dim)] lg:hidden" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          );
        })}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onNew}
          className="h-12 rounded-xl border border-dashed border-[var(--modes-border)] bg-transparent text-copy-14 font-semibold text-[var(--modes-text-muted)] cursor-pointer hover:bg-[var(--modes-surface)]"
        >
          + New service
        </button>
      )}
    </div>
  );
}

function AddPeopleDialog({ open, onClose, candidates, onAdd }) {
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const add = async () => {
    setBusy(true);
    try {
      await onAdd([...picked]);
      setPicked(new Set());
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} ariaLabel="Add people">
      <div className="p-5 flex flex-col gap-4 max-h-[80vh]">
        <h2 className="text-heading-20 m-0 text-[var(--ds-gray-1000)]">Add people</h2>
        {candidates.length === 0 ? (
          <p className="text-copy-14 text-[var(--ds-gray-700)] m-0">Everyone in the team is already on this service.</p>
        ) : (
          <div className="flex flex-col gap-1 overflow-y-auto">
            {candidates.map(m => {
              const on = picked.has(m.user_id);
              return (
                <label key={m.user_id} className="flex items-center gap-3 min-h-[48px] px-2 rounded-lg cursor-pointer hover:bg-[var(--ds-gray-100)]">
                  <input type="checkbox" checked={on} onChange={() => toggle(m.user_id)} className="w-5 h-5 accent-[var(--color-brand)]" />
                  <PersonAvatar member={m} size={28} />
                  <span className="flex-1 min-w-0 text-copy-14 text-[var(--ds-gray-1000)] truncate">{memberName(m)}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={add} disabled={picked.size === 0} loading={busy}>
            {picked.size > 0 ? `Add ${picked.size}` : 'Add'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ServiceDetail({ service, members, serviceMembers, canEdit, api, onDeleted }) {
  const confirm = useConfirm();
  const [name, setName] = useState(service.name);
  const [outline, setOutline] = useState(service.outline || '');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const save = async (patch) => {
    setError(null);
    try { await api.updateService(service.id, patch); } catch (err) { setError(err.message); }
  };

  const onIds = memberIdsOf(service.id, serviceMembers);
  const onService = members.filter(m => onIds.includes(m.user_id));
  const candidates = members.filter(m => !onIds.includes(m.user_id));
  const parts = service.parts || [];

  const togglePart = (id) => save({ parts: parts.includes(id) ? parts.filter(p => p !== id) : [...parts, id] });

  const remove = async (m) => {
    const ok = await confirm({
      title: `Take ${memberName(m)} off ${service.name}?`,
      description: "They stop being asked about this service's dates. Dates they're already playing stay.",
      confirmLabel: 'Take off',
      variant: 'danger',
    });
    if (!ok) return;
    try { await api.removePerson(service.id, m.user_id); } catch (err) { setError(err.message); }
  };

  const del = async () => {
    const ok = await confirm({
      title: `Delete ${service.name}?`,
      description: 'Its template and people list go. Setlists already made for it stay as they are.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try { await api.deleteService(service.id); onDeleted(); } catch (err) { setError(err.message); }
  };

  const otherServicesOf = (uid) => api.services
    .filter(s => s.id !== service.id && memberIdsOf(s.id, serviceMembers).includes(uid))
    .map(s => s.name);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Dot color={service.color} size={14} />
        {canEdit ? (
          <input
            aria-label="Service name"
            value={name}
            maxLength={60}
            onChange={e => setName(e.target.value)}
            onBlur={() => { const v = name.trim(); if (v && v !== service.name) save({ name: v }); else setName(service.name); }}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-heading-24 font-bold text-[var(--modes-text)]"
          />
        ) : (
          <h2 className="text-heading-24 m-0 text-[var(--modes-text)]">{service.name}</h2>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="modes-card min-w-0 p-5 flex flex-col gap-4" aria-label="Template">
          <span className={LABEL}>Template</span>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-label-13 text-[var(--modes-text-muted)]">Day</span>
              <select disabled={!canEdit} value={service.weekday} onChange={e => save({ weekday: Number(e.target.value) })} className={FIELD}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-label-13 text-[var(--modes-text-muted)]">How often</span>
              <select disabled={!canEdit} value={service.nth ?? ''} onChange={e => save({ nth: e.target.value ? Number(e.target.value) : null })} className={FIELD}>
                {NTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-label-13 text-[var(--modes-text-muted)]">Starts</span>
              <input type="time" disabled={!canEdit} value={shortTime(service.start_time)} onChange={e => e.target.value && save({ start_time: e.target.value })} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-label-13 text-[var(--modes-text-muted)]">Ask people ahead</span>
              <select disabled={!canEdit} value={service.ask_weeks} onChange={e => save({ ask_weeks: Number(e.target.value) })} className={FIELD}>
                {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} week{n === 1 ? '' : 's'}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-13 text-[var(--modes-text-muted)]">Colour</span>
            <div className="flex gap-2">
              {SERVICE_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!canEdit}
                  aria-label={c.id}
                  aria-pressed={service.color === c.id}
                  onClick={() => save({ color: c.id })}
                  className="w-9 h-9 rounded-full cursor-pointer border-2 disabled:cursor-default"
                  style={{ background: c.hex, borderColor: service.color === c.id ? 'var(--modes-text)' : 'transparent' }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-label-13 text-[var(--modes-text-muted)]">Band parts</span>
            <div className="flex flex-wrap gap-1.5">
              {PART_OPTIONS.map(p => {
                const on = parts.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={on}
                    onClick={() => togglePart(p.id)}
                    className={`h-8 px-3 rounded-full text-label-13 font-medium cursor-pointer border disabled:cursor-default ${on ? 'bg-[var(--modes-text)] text-[var(--ds-background-100)] border-transparent' : 'bg-transparent text-[var(--modes-text-muted)] border-[var(--modes-border)]'}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-label-13 text-[var(--modes-text-muted)]">Starting songs</span>
            <textarea
              disabled={!canEdit}
              value={outline}
              maxLength={500}
              rows={2}
              placeholder="e.g. Opening song, 3 worship songs, response song"
              onChange={e => setOutline(e.target.value)}
              onBlur={() => { if (outline !== (service.outline || '')) save({ outline }); }}
              className={`${FIELD} h-auto py-2.5 resize-none font-sans`}
            />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-copy-14 text-[var(--modes-text)]">Add newcomers here</span>
              <span className="text-label-12 text-[var(--modes-text-muted)]">Approve all puts new people on this service.</span>
            </span>
            <Switch disabled={!canEdit} checked={!!service.auto_add} onCheckedChange={v => save({ auto_add: v })} aria-label="Add newcomers here" />
          </label>
        </section>

        <section className="modes-card min-w-0 p-5 flex flex-col gap-3" aria-label="People on this service">
          <div className="flex items-center justify-between gap-3">
            <span className={LABEL}>People on this service · {onService.length}</span>
            {canEdit && <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>+ Add people</Button>}
          </div>
          {onService.length === 0 && (
            <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">Nobody yet. Add the people who play in {service.name}.</p>
          )}
          <div className="flex flex-col">
            {onService.map(m => {
              const others = otherServicesOf(m.user_id);
              const inst = (m.instruments || []).map(normalize).filter(Boolean).map(labelFor).join(', ');
              return (
                <div key={m.user_id} className="flex items-center gap-3 min-h-[52px] border-b border-[var(--modes-border)] last:border-b-0">
                  <PersonAvatar member={m} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-copy-14 font-semibold text-[var(--modes-text)] truncate">{memberName(m)}</span>
                    {(inst || others.length > 0) && (
                      <span className="block text-label-12 text-[var(--modes-text-muted)] truncate">
                        {[inst, others.length ? `Also on ${others.join(', ')}` : ''].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => remove(m)}
                      aria-label={`Take ${memberName(m)} off ${service.name}`}
                      className="w-10 h-10 rounded-lg bg-transparent border-none text-[var(--modes-text-dim)] text-[20px] cursor-pointer hover:bg-[var(--modes-surface)]"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {error && <div className="text-copy-13 px-3 py-2 rounded-lg bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]">{error}</div>}

      {canEdit && (
        <div>
          <Button variant="ghost" size="sm" onClick={del} className="text-[var(--ds-red-700)]">Delete service</Button>
        </div>
      )}

      <AddPeopleDialog
        open={adding}
        onClose={() => setAdding(false)}
        candidates={candidates}
        onAdd={(ids) => api.addPeople(service.id, ids)}
      />
    </div>
  );
}

export default function ServicesScreen({ onBack }) {
  const { team, members, canManageBand } = useTeam();
  const api = useTeamServices(team?.id);
  const { services, serviceMembers, ready } = api;
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  // Desktop shows the first service straight away; phones start on the list.
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const effectiveId = selectedId && services.some(s => s.id === selectedId)
    ? selectedId
    : (wide ? services[0]?.id ?? null : null);
  const selected = services.find(s => s.id === effectiveId) || null;

  const createNew = async () => {
    setError(null);
    try {
      const used = new Set(services.map(s => s.color));
      const color = (SERVICE_COLORS.find(c => !used.has(c.id)) || SERVICE_COLORS[0]).id;
      const row = await api.createService({ name: services.length ? 'New service' : 'Sunday Morning', color, weekday: 0, start_time: '10:00' });
      setSelectedId(row.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const showDetailOnly = !wide && selected;
  const headerBack = showDetailOnly ? () => setSelectedId(null) : onBack;

  return (
    <div data-theme-variant="modes" className="relative h-full overflow-y-auto">
      <PageHeader title={showDetailOnly ? 'Service' : 'Services'} onBack={headerBack} />
      <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-6 pb-28">
        {!ready ? (
          <div className="modes-card px-4 py-6 text-center text-copy-14 text-[var(--modes-text-muted)]">
            {team ? 'Services are not set up on the server yet.' : 'Services are a church feature.'}
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-10">
            {!showDetailOnly && (
              <ServiceList
                services={services}
                serviceMembers={serviceMembers}
                selectedId={effectiveId}
                onSelect={setSelectedId}
                onNew={createNew}
                canEdit={canManageBand}
              />
            )}
            {selected && (
              <div className={showDetailOnly ? 'min-w-0' : 'hidden lg:block min-w-0'}>
                <ServiceDetail
                  // Remount when someone else renames it or edits the outline,
                  // so the local text fields pick the new value up.
                  key={`${selected.id}:${selected.name}:${selected.outline}`}
                  service={selected}
                  members={members}
                  serviceMembers={serviceMembers}
                  canEdit={canManageBand}
                  api={api}
                  onDeleted={() => setSelectedId(null)}
                />
              </div>
            )}
          </div>
        )}
        {error && <div className="mt-4 text-copy-13 px-3 py-2 rounded-lg bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]">{error}</div>}
      </div>
    </div>
  );
}
