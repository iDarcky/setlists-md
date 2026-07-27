import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/ui/Button';
import { createSetlistShare, revokeSetlistShare } from '@/share/setlistShare';

const EXPIRY_OPTIONS = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

// Create / show / revoke a public share link for a setlist. Snapshot-based:
// publishing freezes the current setlist + its songs under a random token.
export default function ShareSetlistDialog({ setlist, songs, ownerId, onClose }) {
  const [expiryDays, setExpiryDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [link, setLink] = useState(null); // { token, url, expiresAt }
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!link?.url) { setQr(null); return; }
    QRCode.toDataURL(link.url, { margin: 1, width: 220 }).then(setQr).catch(() => setQr(null));
  }, [link]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createSetlistShare(setlist, songs, { expiresInDays: expiryDays, ownerId });
      setLink(res);
    } catch (err) {
      setError(err.message || 'Could not create the link.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — user can select manually */ }
  };

  const revoke = async () => {
    if (!link) return;
    setBusy(true);
    try {
      await revokeSetlistShare(link.token);
      setLink(null);
    } catch (err) {
      setError(err.message || 'Could not revoke the link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ds-gray-200)]">
          <h2 className="text-heading-18 text-[var(--ds-gray-1000)] m-0 font-semibold">Share setlist</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer text-[var(--ds-gray-600)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {!link ? (
            <>
              <p className="text-copy-14 text-[var(--ds-gray-700)] m-0">
                Anyone with the link can view a read-only copy of “{setlist.name || 'this setlist'}”. It’s a snapshot — later edits won’t change what they see.
              </p>
              <div>
                <span className="text-label-12 text-[var(--ds-gray-700)] uppercase tracking-wider font-semibold mb-2 block">Link expires</span>
                <div className="flex flex-wrap gap-2">
                  {EXPIRY_OPTIONS.map(o => (
                    <Button key={o.days} variant={expiryDays === o.days ? 'brand' : 'secondary'} size="sm" onClick={() => setExpiryDays(o.days)}>
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>
              {error && <div className="text-copy-13 px-3 py-2 rounded-lg bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]">{error}</div>}
            </>
          ) : (
            <>
              {qr && (
                <div className="flex justify-center">
                  <img src={qr} alt="QR code for the share link" width={200} height={200} className="rounded-lg border border-[var(--ds-gray-300)]" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link.url}
                  onFocus={e => e.target.select()}
                  className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] text-copy-13 text-[var(--ds-gray-1000)] outline-none"
                />
                <Button variant="brand" size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
              </div>
              <p className="text-label-12 text-[var(--ds-gray-600)] m-0">
                {link.expiresAt
                  ? `Expires ${new Date(link.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.`
                  : 'This link does not expire until you revoke it.'}
              </p>
              {error && <div className="text-copy-13 px-3 py-2 rounded-lg bg-[var(--ds-red-100)] text-[var(--ds-red-1000)]">{error}</div>}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--ds-gray-200)] bg-[var(--ds-background-200)]">
          {!link ? (
            <>
              <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button variant="brand" size="sm" onClick={create} loading={busy}>Create link</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={revoke} disabled={busy} className="text-[var(--ds-red-700)] mr-auto">Revoke</Button>
              <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
