import { useEntitlement } from '@/hooks/useEntitlement';
import { Button } from './Button';

const PLAN_LABELS = {
  sync: 'Sync',
  team: 'Teams',
  church: 'Church',
};

const PLAN_DESCRIPTIONS = {
  sync: 'Sync your library across every device with your own cloud storage.',
  team: 'Create a shared library and collaborate with your worship team in real time.',
  church: 'Multi-service setlist management, 30 seats, and priority support for your church.',
};

const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Wraps content that requires a specific entitlement. If the user doesn't
 * have access, renders a branded upgrade prompt instead of children.
 *
 * @param {{ feature: string, onUpgrade: () => void, children: React.ReactNode }} props
 */
export default function UpgradeGate({ feature, onUpgrade, children }) {
  const { allowed, requiredPlan } = useEntitlement(feature);

  if (allowed) return children;

  const label = PLAN_LABELS[requiredPlan] || requiredPlan;
  const description = PLAN_DESCRIPTIONS[requiredPlan] || `Upgrade to the ${label} plan to unlock this feature.`;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center flex flex-col items-center gap-4"
        style={{
          background: 'var(--ds-background-100)',
          border: '1px solid var(--ds-gray-400)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}
        >
          <LockIcon />
        </div>

        <h2 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 leading-tight">
          {label} Plan Feature
        </h2>

        <p className="text-copy-14 text-[var(--ds-gray-600)] m-0 leading-relaxed max-w-sm">
          {description}
        </p>

        <Button variant="brand" size="lg" onClick={onUpgrade} className="w-full mt-2">
          View Plans
        </Button>
      </div>
    </div>
  );
}
