import { sileo } from 'sileo';

// Every toast in the app, on Sileo (owner, 2026-11-15). The update pill keeps
// its own Toaster (UpdatePill.jsx, top centre on a phone); everything else
// sits BOTTOM RIGHT on every screen size. Below 1024px the nav pill is at the
// bottom, so toasts sit above it (and above the phone Save bar).
//
// Rule for adding one: a toast is only for something the person can't see on
// screen, or can undo. If the screen already shows the change, don't toast.
// See /mnt/project-files/design-basics/toasts-to-cut.md.

// Ink fill on both themes: the toast reads as one object, not a card.
const FILL = { dark: '#2A2724', light: '#1C1A17' };
// Deletes with Undo are the only red toast.
const DANGER = '#B4413A';

const STYLES = {
  title: '!normal-case !font-semibold !text-[#F3EFE8] !font-sans',
  description: '!text-[#C9C2B8] !font-sans',
};
const DANGER_STYLES = {
  title: STYLES.title,
  description: '!text-white/85 !font-sans',
  badge: '!bg-white/20 !text-white',
  button: '!bg-white !text-[#8A2F27] !font-semibold',
};

const theme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

// The toaster lives in a manual popover so it can be lifted into the top
// layer, above a phone sheet (scrollsheet is a native <dialog>, which would
// otherwise cover any toast).
let host = null;
/** AppToaster registers its popover element here. */
export function setToastHost(el) { host = el; }
export function liftToasts() { lift(); }
function lift() {
  if (!host?.showPopover) return;
  try {
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  } catch { /* not supported: stays in the normal layer */ }
}

const KIND = { error: 'error', danger: 'error', destructive: 'error', warning: 'warning', info: 'info', success: 'success' };

/** toast({ title, description, variant: 'error' | 'warning' | 'info' | 'success', duration }) */
export function toast({ title, description, variant, duration } = {}) {
  const type = KIND[variant] || 'success';
  const id = sileo.show({
    type,
    title: typeof title === 'string' ? title : String(title ?? ''),
    description,
    fill: FILL[theme()],
    styles: STYLES,
    ...(duration ? { duration } : {}),
  });
  lift();
  return { id, dismiss: () => sileo.dismiss(id), update: () => {} };
}

/** A delete that can be undone: red, white Undo, 5 seconds. */
export function undoToast({ title, description, onUndo }) {
  let id;
  id = sileo.action({
    title,
    description,
    fill: DANGER,
    styles: DANGER_STYLES,
    duration: 5000,
    button: { title: 'Undo', onClick: () => { onUndo?.(); sileo.dismiss(id); } },
  });
  lift();
  return { id, dismiss: () => sileo.dismiss(id) };
}

