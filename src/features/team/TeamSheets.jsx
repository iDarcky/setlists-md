import { useEffect, useState } from 'react';
import { cn } from '@/ui/shadcn/utils';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';
import { Input } from '@/ui/shadcn/input';
import { Avatar } from '@/app/AppTopBar';
import { CheckIcon } from '@/app/navIcons';
import { displayTokens } from '@/data/instruments';
import { roleDef } from '@/lib/teamRoles';
import AvatarUploader from '@/ui/AvatarUploader';
import { memberName } from '@/lib/teamPeople';

// The two pop-ups of the Team page: a person, and the church info (owner).
// Drawer on a phone, dialog from the iPad up (Sheet).

const PICKS = ['leader', 'editor', 'member'];

const ANSWER = {
  available: { label: 'Said yes', cls: 'bg-selected text-link' },
  maybe: { label: 'Maybe', cls: 'bg-warning/15 text-warning-text' },
  unavailable: { label: 'Can’t', cls: 'bg-danger/15 text-danger' },
  pending: { label: 'Asked', cls: 'bg-warning/15 text-warning-text' },
};

const Label = ({ children }) => <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</h3>;

/**
 * Body of the person pop-up. `canManage`: may change their role and remove
 * them. `canMakeAdmin`: the owner, who alone hands out "can change roles".
 */
export function PersonBody({ member, isOwnerRow = false, me = false, since = '', upcoming = [], canManage = false, canMakeAdmin = false, onRole, onRemove, onLeave, busy = false }) {
  const parts = displayTokens(member.instruments);
  const role = member.role || 'member';
  const pick = role === 'admin' ? 'leader' : role;
  const editable = canManage && !me && !isOwnerRow;
  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-3.5">
        <Avatar name={memberName(member)} url={member.profile?.avatar_url} size={56} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[20px] font-semibold leading-7">{memberName(member)}{me && <span className="font-normal text-muted-foreground"> (you)</span>}</span>
          <span className="truncate text-[14px] text-muted-foreground">{[isOwnerRow ? 'Owner' : roleDef(role).id === 'admin' ? 'Leader' : roleDef(role).label, since].filter(Boolean).join(' · ')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Plays</Label>
        {parts.length
          ? <div className="flex flex-wrap gap-2">{parts.map(p => <span key={p.token} className="flex h-8 items-center rounded-full border border-chip-border px-3 text-[14px]">{p.label}</span>)}</div>
          : <p className="m-0 text-[14px] text-muted-foreground">{me ? 'Add what you play in your profile.' : 'Hasn’t said yet.'}</p>}
      </div>

      {editable && (
        <div className="flex flex-col gap-2">
          <Label>Role</Label>
          <div role="radiogroup" aria-label="Role" className="flex flex-col overflow-hidden rounded-card border border-border">
            {PICKS.map(id => {
              const on = pick === id;
              return (
                <button key={id} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => !on && onRole?.(id)}
                  className={cn('flex w-full cursor-pointer items-start gap-3 border-0 border-t border-border bg-transparent px-4 py-3 text-left font-sans text-foreground outline-none first:border-t-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', on && 'bg-raised')}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{roleDef(id).label}</span>
                    <span className="text-[13px] leading-5 text-muted-foreground">{roleDef(id).blurb}</span>
                  </span>
                  <span className={cn('mt-0.5 text-link', !on && 'invisible')}><CheckIcon /></span>
                </button>
              );
            })}
          </div>
          {pick === 'leader' && canMakeAdmin && (
            <label className="flex cursor-pointer items-center gap-3 pt-1 text-[14px]">
              <input type="checkbox" className="size-5 accent-[var(--color-link)]" checked={role === 'admin'} disabled={busy}
                onChange={(e) => onRole?.(e.target.checked ? 'admin' : 'leader')} />
              Can also change roles and remove people
            </label>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Coming up</Label>
        {upcoming.length ? (
          <div className="flex flex-col">
            {upcoming.map(u => (
              <div key={u.id} className="flex min-h-12 items-center gap-3 border-t border-border py-2 first:border-t-0">
                <span className="min-w-0 flex-1 truncate text-[15px]">{u.label} · {u.name}</span>
                {ANSWER[u.answer] && <span className={cn('flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold', ANSWER[u.answer].cls)}>{ANSWER[u.answer].label}</span>}
              </div>
            ))}
          </div>
        ) : <p className="m-0 text-[14px] text-muted-foreground">Not in any band coming up.</p>}
      </div>

      {editable && onRemove && <Button variant="outline" className="text-danger" disabled={busy} onClick={onRemove}>Remove from the church</Button>}
      {me && !isOwnerRow && onLeave && <Button variant="outline" className="text-danger" disabled={busy} onClick={onLeave}>Leave this church</Button>}
    </div>
  );
}

export function PersonSheet({ open, onOpenChange, member, ...rest }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={member ? memberName(member) : 'Person'}>
      {member && <PersonBody member={member} {...rest} />}
    </Sheet>
  );
}

const FIELDS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'location', label: 'City', placeholder: 'e.g. Cluj-Napoca' },
  { id: 'address', label: 'Address', placeholder: 'Street and number' },
  { id: 'website', label: 'Website', placeholder: 'e.g. gracechurch.ro', type: 'url' },
  { id: 'ccli_licence', label: 'CCLI licence number', hint: 'Optional. Shown to your church only.', inputMode: 'numeric' },
];

/** Church info, edit. Only the owner sees it. */
export function ChurchBody({ team, onSave, onLogo, missingColumns = false }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(f => [f.id, team[f.id] || ''])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setForm(Object.fromEntries(FIELDS.map(f => [f.id, team[f.id] || '']))); }, [team]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true); setError(null);
    try {
      await onSave(Object.fromEntries(FIELDS.map(f => [f.id, form[f.id].trim() || (f.required ? form[f.id].trim() : null)])));
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5 font-sans">
      <div className="flex flex-col gap-2">
        <AvatarUploader url={team.logo_url || null} fallback={(team.name || 'C').trim().charAt(0).toUpperCase()}
          pathPrefix={`teams/${team.id}`} shape="square" label="logo" onChange={onLogo} />
        <span className="text-[13px] text-muted-foreground">Shows on guest links and printouts.</span>
      </div>
      {FIELDS.map(f => {
        const off = missingColumns && ['address', 'website', 'ccli_licence'].includes(f.id);
        return (
          <label key={f.id} className="flex flex-col gap-1.5">
            <span className="text-[14px] font-medium">{f.label}</span>
            <Input value={form[f.id]} required={f.required} placeholder={f.placeholder} inputMode={f.inputMode} disabled={off}
              onChange={(e) => setForm(prev => ({ ...prev, [f.id]: e.target.value }))} />
            {f.hint && <span className="text-[13px] text-muted-foreground">{f.hint}</span>}
          </label>
        );
      })}
      {missingColumns && <p className="m-0 text-[13px] text-muted-foreground">Address, website and licence need a database update first.</p>}
      {error && <p className="m-0 text-[14px] text-danger">{error}</p>}
      <Button type="submit" loading={busy} disabled={busy || !form.name.trim()}>Save</Button>
    </form>
  );
}

export function ChurchSheet({ open, onOpenChange, team, ...rest }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Church info">
      {team && <ChurchBody team={team} {...rest} />}
    </Sheet>
  );
}
