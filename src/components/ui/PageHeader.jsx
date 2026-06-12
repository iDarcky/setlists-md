// Shared page sub-header.
//
// Desktop (sm+): mirrors the Library / Setlists header exactly — a blurred
// sticky bar with a big title and an optional actions slot on the right.
//
// Mobile (<sm): an Obsidian/Preferences-style compact bar — an optional back
// chevron on the LEFT (used inside submenus), the title centred, and an
// optional X close on the RIGHT (used at the top level of a section). Pass
// `onBack` for submenus and `onClose` for the top level; pass both when a
// submenu should also offer a quick exit.

const BAR = 'sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--ds-background-100)_80%,transparent)] border-b border-[var(--modes-border)]';
const ICON_BTN = 'w-10 h-10 rounded-xl flex items-center justify-center text-[var(--modes-text)] hover:bg-[var(--modes-surface)] active:scale-95 transition-all bg-transparent border-none cursor-pointer shrink-0';

export default function PageHeader({ title, actions = null, onBack, onClose }) {
  return (
    <>
      {/* Desktop — identical to Library / Setlists */}
      <header className={`${BAR} hidden sm:block`}>
        <div className="w-full max-w-[1320px] mx-auto px-5 sm:px-8 pt-5 sm:pt-7 pb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-heading-32 font-bold text-[var(--modes-text)] m-0 mr-2">{title}</h1>
          {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
        </div>
      </header>

      {/* Mobile — back (submenu) · title · close (top level) */}
      <header className={`${BAR} sm:hidden`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2 px-3 h-14">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back" className={ICON_BTN}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          ) : <span className="w-10 shrink-0" />}
          <h1 className="flex-1 min-w-0 text-heading-18 font-bold text-[var(--modes-text)] truncate text-center m-0">{title}</h1>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close" className={ICON_BTN}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          ) : <span className="w-10 shrink-0" />}
        </div>
        {actions && <div className="px-3 pb-3 flex items-center justify-center gap-2">{actions}</div>}
      </header>
    </>
  );
}
