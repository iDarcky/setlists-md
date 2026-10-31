import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';

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
    <Sheet open={open} onOpenChange={(o) => { if (!o) setDismissed(true); }} title="A new version is ready" className="h-auto max-h-[80dvh] sm:max-w-[420px]">
      <div className="flex flex-col gap-5 font-sans">
        <p className="m-0 text-[15px] leading-6 text-muted-foreground">
          Reload to get the latest fixes. It keeps every phone in the church on the same version, so your songs sync properly.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <Button onClick={() => updateServiceWorker(true)}>Reload now</Button>
          <Button variant="ghost" onClick={() => setDismissed(true)}>Later</Button>
        </div>
      </div>
    </Sheet>
  );
}
