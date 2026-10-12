import React, { useState } from 'react';
import { Button } from '@/ui/Button';
import { toast } from '@/ui/use-toast';
import { useAuth } from '@/auth/useAuth';
import {
  connectProvider,
  disconnectProvider,
  getAvailableProviders,
} from '@/sync/provider';

// Settings → Cloud Sync, for the personal library. Two things, kept apart:
//   1. SYNC — the account's workspace on Supabase (the replica). It is on or
//      it is not; nothing to connect.
//   2. BACKUP — a folder the user owns (Drive / Dropbox / OneDrive) that
//      mirrors the library as files. One way: written after every change,
//      read only when the user asks to restore. Never a second sync engine
//      (docs/SYNC-REDESIGN.md §4.3).

function isStandaloneMode() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : null);

export default function SyncSettings({
  syncState,
  onSyncNow,
  backupState,
  onBackupStateChange,
  onBackupNow,
  onRestoreFromBackup,
  cloudAllowed = false,
  onUpgrade,
  onRequestSignIn,
}) {
  const { user } = useAuth();
  const providers = getAvailableProviders();
  const [busy, setBusy] = useState(null); // provider name, '__disconnect', '__backup', '__restore' or null
  const standalone = isStandaloneMode();

  const backupName = backupState?.provider || null;
  const backupLabel = providers.find(p => p.name === backupName)?.displayName || backupName;
  const needsReconnect = backupState?.state === 'needs-reconnect';

  const handleConnect = async (name) => {
    setBusy(name);
    try {
      await connectProvider(name);
      onBackupStateChange?.({ state: 'idle', provider: name, lastBackup: null });
      toast({ title: 'Folder connected', description: `Backing up your library to ${providers.find(p => p.name === name)?.displayName}.` });
      // The first backup right away, so the folder is never connected and empty.
      try { await onBackupNow?.(); } catch { /* surfaced by the mirror's status */ }
    } catch (err) {
      toast({ title: 'Connect failed', description: err?.message || 'Could not complete sign-in with the provider.', variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy('__disconnect');
    try {
      await disconnectProvider();
      onBackupStateChange?.({ state: 'idle', provider: null, lastBackup: null });
      toast({ title: 'Folder disconnected', description: 'The files already in the folder stay there.' });
    } catch (err) {
      toast({ title: 'Disconnect failed', description: err?.message, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleBackupNow = async () => {
    setBusy('__backup');
    try { await onBackupNow?.(); } finally { setBusy(null); }
  };

  const handleRestore = async () => {
    setBusy('__restore');
    try {
      await onRestoreFromBackup?.();
    } catch (err) {
      toast({ title: 'Restore failed', description: err?.message, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // Signed-out users get a sign-in CTA instead of the two cards.
  if (!user) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2">
          Cloud Sync
        </h2>
        <div className="modes-card p-5 flex flex-col gap-3 border-dashed">
          <h3 className="text-heading-16 text-[var(--modes-text)] m-0 font-semibold">
            Sign in to sync and back up
          </h3>
          <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
            Setlists.md cloud keeps your library on every signed-in device. A backup folder in
            Google Drive, Dropbox or OneDrive keeps a copy of it as files you own.
          </p>
          <Button variant="brand" size="sm" onClick={onRequestSignIn} className="self-start">
            Sign in
          </Button>
        </div>
      </section>
    );
  }

  const cloudOn = !!syncState?.provider && syncState.provider.startsWith('supabase-personal:');
  const syncing = syncState?.state === 'syncing';

  return (
    <section className="flex flex-col gap-4">
      {/* ── Sync ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center px-2">
        <h2 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
          Cloud Sync
        </h2>
        {cloudOn && (
          <Button variant="ghost" size="sm" onClick={onSyncNow} loading={syncing}>
            Sync Now
          </Button>
        )}
      </div>

      <div className="modes-card flex flex-col p-0 overflow-hidden divide-y" style={{ borderColor: 'var(--modes-border)' }}>
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="text-copy-14 text-[var(--modes-text)] font-medium flex items-center gap-2">
              ☁️ Setlists.md cloud
              <span className="text-label-11 uppercase tracking-wider text-[var(--color-brand)] font-semibold">Pro</span>
            </span>
            <span className="text-copy-13 text-[var(--modes-text-muted)]">
              {cloudOn
                ? (syncState.lastSync ? `Your library follows you to every signed-in device. Last synced ${fmtTime(syncState.lastSync)}.` : 'Your library follows you to every signed-in device.')
                : cloudAllowed
                  ? 'Setting up your workspace…'
                  : 'Your library stays on this device. Setlists.md cloud syncs it to every device you sign in on.'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            {cloudOn ? (
              <>
                <div className={`h-2 w-2 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : syncState.state === 'error' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="text-label-12 uppercase font-semibold text-[var(--modes-text-muted)]">
                  {syncing ? 'Syncing…' : syncState.state === 'error' ? 'Problem' : 'On'}
                </span>
              </>
            ) : cloudAllowed ? null : (
              onUpgrade && <Button size="sm" variant="brand" onClick={onUpgrade}>Upgrade</Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Backup folder ────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center px-2 mt-2">
        <h2 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
          Backup folder
        </h2>
        {backupName && !needsReconnect && (
          <Button variant="ghost" size="sm" onClick={handleBackupNow} loading={busy === '__backup' || backupState?.state === 'backing-up'}>
            Back up now
          </Button>
        )}
      </div>

      <div className="modes-card flex flex-col p-0 overflow-hidden divide-y" style={{ borderColor: 'var(--modes-border)' }}>
        <div className="p-4 flex flex-col gap-1">
          <span className="text-copy-13 text-[var(--modes-text-muted)]">
            A copy of your songs and setlists as <code>.md</code> and <code>.json</code> files in a folder you own.
            The app writes the folder after every change and never reads it back — unless you ask it to restore.
          </span>
          {backupName && (
            <span className="text-copy-13 text-[var(--modes-text-muted)]">
              {backupState?.state === 'backing-up'
                ? 'Backing up…'
                : backupState?.state === 'error'
                  ? `Last backup had a problem${backupState.errors?.[0]?.message ? `: ${backupState.errors[0].message}` : '.'}`
                  : backupState?.lastBackup
                    ? `Last backup ${fmtTime(backupState.lastBackup)}.`
                    : 'Connected.'}
            </span>
          )}
        </div>

        {needsReconnect && backupName && (
          <div className="p-4 flex flex-col gap-2 bg-[var(--ds-amber-100)]" style={{ borderColor: 'var(--modes-border)' }}>
            <p className="text-copy-13 text-[var(--ds-amber-900)] m-0 font-semibold">
              Reconnect {backupLabel}
            </p>
            <p className="text-copy-13 text-[var(--ds-amber-800)] m-0">
              Your sign-in with {backupLabel} has expired (this happens after long periods of inactivity, or if you
              revoked access). Backups are paused until you reconnect.
            </p>
            <div className="flex gap-2 mt-1">
              <Button variant="brand" size="sm" onClick={() => handleConnect(backupName)} loading={busy === backupName}>
                Reconnect
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDisconnect} loading={busy === '__disconnect'}>
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {standalone && !backupName && (
          <div className="p-4 flex flex-col gap-2 bg-[var(--ds-amber-100)]" style={{ borderColor: 'var(--modes-border)' }}>
            <p className="text-copy-13 text-[var(--ds-amber-900)] m-0 font-medium">
              Connecting a folder needs a browser window.
            </p>
            <p className="text-copy-13 text-[var(--ds-amber-800)] m-0">
              Open this page in Safari, connect the folder there, then return to the app — the connection carries over.
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-copy-13 font-semibold text-[var(--ds-amber-900)] underline self-start"
            >
              Open in Safari →
            </a>
          </div>
        )}

        {providers.map(p => {
          const isActive = backupName === p.name;
          return (
            <div key={p.name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col">
                <span className="text-copy-14 text-[var(--modes-text)] font-medium flex items-center gap-2">
                  {p.icon} {p.displayName}
                </span>
                <span className="text-copy-13 text-[var(--modes-text-muted)]">
                  {!p.configured
                    ? 'Not configured on this build.'
                    : isActive
                      ? 'Connected. Your library is mirrored here.'
                      : standalone
                        ? 'Use Safari to connect (see above).'
                        : 'Keep a copy of your library in this folder.'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                {isActive ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={handleRestore} loading={busy === '__restore'} disabled={needsReconnect || busy != null && busy !== '__restore'}>
                      Restore missing
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleDisconnect} loading={busy === '__disconnect'} disabled={busy != null && busy !== '__disconnect'}>
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={() => handleConnect(p.name)}
                    loading={busy === p.name}
                    disabled={!p.configured || standalone || (backupName && backupName !== p.name) || busy != null}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-copy-12 text-[var(--modes-text-dim)] px-2">
        {backupName
          ? 'One folder at a time. "Restore missing" adds anything in the folder that your library does not have; it never overwrites a song you already have.'
          : 'A backup is not sync: two devices each backing up to the same folder would overwrite each other. Use Setlists.md cloud to keep devices together.'}
      </p>
    </section>
  );
}
