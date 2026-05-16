import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { toast } from '../ui/use-toast';
import { useAuth } from '../../auth/useAuth';
import {
  connectProvider,
  disconnectProvider,
  getAvailableProviders,
} from '../../sync/provider';

function isStandaloneMode() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export default function SyncSettings({ syncState, onSyncStateChange, onSyncNow, onRequestSignIn }) {
  const { user } = useAuth();
  const providers = getAvailableProviders();
  const [busy, setBusy] = useState(null); // provider name or null
  const standalone = isStandaloneMode();

  const handleConnect = async (name) => {
    setBusy(name);
    try {
      await connectProvider(name);
      onSyncStateChange({ ...syncState, provider: name, state: 'idle' });
      toast({ title: 'Connected', description: `Syncing with ${providers.find(p => p.name === name)?.displayName}.` });
      // Kick off an initial sync so the user's existing songs and setlists
      // get pushed to the cloud right away — otherwise they have to find
      // and click "Sync Now" themselves and the cloud looks empty.
      try { await onSyncNow?.(); } catch { /* errors surfaced by triggerSync */ }
    } catch (err) {
      toast({
        title: 'Connect failed',
        description: err?.message || 'Could not complete sign-in with the provider.',
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy('__disconnect');
    try {
      await disconnectProvider();
      onSyncStateChange({ ...syncState, provider: null, state: 'idle' });
      toast({ title: 'Disconnected' });
    } catch (err) {
      toast({ title: 'Disconnect failed', description: err?.message, variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // Signed-out users get a sign-in CTA instead of provider buttons.
  if (!user) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2">
          Cloud Sync
        </h2>
        <div className="modes-card p-5 flex flex-col gap-3 border-dashed">
          <h3 className="text-heading-16 text-[var(--modes-text)] m-0 font-semibold">
            Sign in to enable cloud sync
          </h3>
          <p className="text-copy-14 text-[var(--modes-text-muted)] m-0">
            Cloud sync with Google Drive, Dropbox, or OneDrive is a Pro feature.
            Sign in to connect your account.
          </p>
          <Button variant="brand" size="sm" onClick={onRequestSignIn} className="self-start">
            Sign in
          </Button>
        </div>
      </section>
    );
  }

  const activeName = syncState.provider;
  const needsReconnect = syncState.state === 'needs-reconnect';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
          Cloud Sync
        </h2>
        {activeName && (
          <Button variant="ghost" size="sm" onClick={onSyncNow} loading={syncState.state === 'syncing'}>
            Sync Now
          </Button>
        )}
      </div>

      <div className="modes-card flex flex-col p-0 overflow-hidden divide-y" style={{ borderColor: 'var(--modes-border)' }}>
        <div className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="text-copy-14 text-[var(--modes-text)] font-medium">Status</span>
            <span className="text-copy-13 text-[var(--modes-text-muted)]">
              {syncState.lastSync ? `Last synced: ${new Date(syncState.lastSync).toLocaleString()}` : 'Not connected'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <div className={`h-2 w-2 rounded-full ${syncState.state === 'syncing' ? 'bg-amber-400 animate-pulse' : needsReconnect ? 'bg-amber-400' : activeName ? 'bg-emerald-400' : 'bg-[var(--modes-border)]'}`} />
            <span className="text-label-12 uppercase font-semibold text-[var(--modes-text-muted)]">
              {syncState.state === 'syncing' ? 'Syncing…' : needsReconnect ? 'Reconnect needed' : activeName ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {needsReconnect && activeName && (
          <div className="p-4 flex flex-col gap-2 bg-[var(--ds-amber-100)]" style={{ borderColor: 'var(--modes-border)' }}>
            <p className="text-copy-13 text-[var(--ds-amber-900)] m-0 font-semibold">
              Reconnect your cloud
            </p>
            <p className="text-copy-13 text-[var(--ds-amber-800)] m-0">
              Your sign-in with {providers.find(p => p.name === activeName)?.displayName || 'your provider'} has expired
              (this happens after long periods of inactivity, or if you revoked access). Reconnect once and you're good for
              another six months.
            </p>
            <div className="flex gap-2 mt-1">
              <Button
                variant="brand"
                size="sm"
                onClick={() => handleConnect(activeName)}
                loading={busy === activeName}
              >
                Reconnect {providers.find(p => p.name === activeName)?.displayName || activeName}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                loading={busy === '__disconnect'}
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {standalone && !activeName && (
          <div className="p-4 flex flex-col gap-2 bg-[var(--ds-amber-100)]" style={{ borderColor: 'var(--modes-border)' }}>
            <p className="text-copy-13 text-[var(--ds-amber-900)] m-0 font-medium">
              Cloud sync setup requires a browser window.
            </p>
            <p className="text-copy-13 text-[var(--ds-amber-800)] m-0">
              Open this page in Safari, connect your provider there, then return to the app — your connection will carry over automatically.
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
          const isActive = activeName === p.name;
          const isBusy = busy === p.name;
          return (
            <div key={p.name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col">
                <span className="text-copy-14 text-[var(--modes-text)] font-medium flex items-center gap-2">
                  {p.icon} {p.displayName}
                  <span className="text-label-11 uppercase tracking-wider text-[var(--color-brand)] font-semibold">Pro</span>
                </span>
                <span className="text-copy-13 text-[var(--modes-text-muted)]">
                  {!p.configured
                    ? 'Not configured on this build.'
                    : isActive
                      ? 'Connected. Syncing enabled.'
                      : standalone
                        ? 'Use Safari to connect (see above).'
                        : 'Tap Connect to enable sync with this provider.'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                {isActive ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDisconnect}
                    loading={busy === '__disconnect'}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={() => handleConnect(p.name)}
                    loading={isBusy}
                    disabled={!p.configured || standalone || (activeName && activeName !== p.name) || busy != null}
                  >
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeName && (
        <p className="text-copy-12 text-[var(--modes-text-dim)] px-2">
          Only one provider at a time. Disconnect to switch.
        </p>
      )}
    </section>
  );
}
