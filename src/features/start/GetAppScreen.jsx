import { lazy, Suspense, useEffect, useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { usePushSubscription } from '@/push/usePushSubscription';
import { GetAppView } from '@/features/intro/IntroStartViews';
import { phoneInBrowser } from '@/lib/phoneInBrowser';

const IOSInstallHint = lazy(() => import('@/features/onboarding/IOSInstallHint'));

// "Put Setlists.md on your phone" (C2): add to Home Screen and turn on
// alerts, with their live state. The last setting-up screen, for people
// joining and for the leader who made the team.
export default function GetAppScreen({ teamName, onOpen, onBack, progress }) {
  const [show] = useState(() => phoneInBrowser());
  useEffect(() => { if (!show) onOpen?.(); }, [show]); // eslint-disable-line react-hooks/exhaustive-deps -- once
  if (!show) return null;
  return <GetApp teamName={teamName} onOpen={onOpen} onBack={onBack} progress={progress} />;
}

function GetApp({ teamName, onOpen, onBack, progress }) {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const push = usePushSubscription();
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [installAnswered, setInstallAnswered] = useState(false);

  const installDone = isStandalone || installAnswered;
  let installAction = null;
  if (!installDone && canInstall) {
    installAction = {
      label: 'Install',
      onClick: async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') setInstallAnswered(true);
      },
    };
  } else if (!installDone && isIOS) {
    installAction = { label: 'Show me', onClick: () => setShowIOSHint(true) };
  }
  const installBody = installDone
    ? 'Done. Open it from your Home Screen.'
    : (canInstall || isIOS)
      ? 'Opens full screen, works offline'
      : 'In your browser menu, pick “Add to Home Screen”';

  let alertsAction = null;
  let alertsBody = 'Hear when you’re asked to play';
  if (push.subscribed) {
    alertsBody = 'On';
  } else if (push.denied) {
    alertsBody = 'Blocked. Allow alerts in your browser settings.';
  } else if (!push.supported) {
    alertsBody = isIOS ? 'Add it to your Home Screen first' : 'This browser can’t show alerts';
  } else {
    alertsAction = { label: 'Turn on', onClick: () => push.enable(), busy: push.busy };
  }

  return (
    <>
      <GetAppView
        teamName={teamName || 'your team'}
        install={{ title: 'Add to Home Screen', body: installBody, done: installDone, action: installAction }}
        alerts={{ title: 'Turn on alerts', body: alertsBody, done: push.subscribed, action: alertsAction }}
        onOpen={onOpen}
        onBack={onBack}
        progress={progress}
      />
      {showIOSHint && (
        <Suspense fallback={null}>
          <IOSInstallHint onClose={() => setShowIOSHint(false)} />
        </Suspense>
      )}
    </>
  );
}
