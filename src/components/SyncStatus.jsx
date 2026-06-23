export default function SyncStatus({ syncState, onClick }) {
  const { state, lastSync, provider } = syncState;

  const dotColors = {
    idle: 'var(--ds-gray-500)',
    syncing: 'var(--color-brand)',
    synced: 'var(--ds-success-900)',
    error: 'var(--ds-error-900)',
    offline: 'var(--ds-gray-500)',
    'needs-reconnect': 'var(--ds-error-900)',
  };

  const labels = {
    idle: provider ? 'Idle' : 'Offline',
    syncing: 'Syncing…',
    synced: lastSync ? formatRelative(lastSync) : 'Synced',
    error: 'Sync error',
    offline: 'Offline — will sync',
    'needs-reconnect': 'Reconnect',
  };

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] cursor-pointer text-label-11 font-semibold text-[var(--ds-gray-600)] hover:bg-[var(--ds-gray-200)] transition-colors"
    >
      <span
        className="inline-block w-[7px] h-[7px] rounded-full"
        style={{
          background: dotColors[state] || dotColors.idle,
          animation: state === 'syncing' ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      {labels[state] || 'Offline'}
    </button>
  );
}

function formatRelative(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
