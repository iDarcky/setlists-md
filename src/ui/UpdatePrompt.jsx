import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Dialog } from './Dialog';
import { Button } from './Button';

// Prominent "new version available" prompt. Replaces the old toast: when the
// service worker finishes downloading a new bundle, a modal asks the user to
// reload. `updateServiceWorker(true)` calls skipWaiting() then reloads onto the
// fresh bundle — keeping every device on the same version (which is what stops
// cross-version sync drift).
//
// `suppress` hides the modal without tearing down the SW registration — used to
// avoid interrupting a live/performance set. The prompt reappears the moment
// the user leaves that view (needRefresh stays true).
export default function UpdatePrompt({ suppress = false }) {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(err) {
      console.warn('[pwa] service worker registration failed:', err);
    },
  });

  const open = needRefresh && !suppress && !dismissed;

  return (
    <Dialog open={open} onClose={() => setDismissed(true)} closeOnBackdrop={false} size="sm" ariaLabel="Update available">
      <div className="p-6 flex flex-col gap-4 text-center">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">
            New version available
          </h2>
          <p className="text-copy-13 text-[var(--ds-gray-700)] m-0">
            Reload to get the latest fixes and keep your library syncing correctly
            across all your devices.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="brand" onClick={() => updateServiceWorker(true)}>
            Reload now
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-copy-13 text-[var(--ds-gray-600)] bg-transparent border-none cursor-pointer hover:text-[var(--ds-gray-1000)]"
          >
            Later
          </button>
        </div>
      </div>
    </Dialog>
  );
}
