import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Geist-style underline tab component.
 *
 * Usage:
 *   <Tabs
 *     tabs={[{ id: 'overview', label: 'Overview' }, { id: 'details', label: 'Details' }]}
 *     activeTab="overview"
 *     onTabChange={(id) => setActiveTab(id)}
 *   />
 */
function Tabs({ tabs, activeTab, onTabChange, className }) {
  return (
    <div className={cn("flex", className)}>
      {tabs.map(t => {
        const active = activeTab === t.id;
        const disabled = t.disabled;
        return (
          <button
            key={t.id}
            onClick={() => !disabled && onTabChange(t.id)}
            disabled={disabled}
            className={cn(
              "relative px-3.5 py-2 text-label-12 font-semibold transition-colors duration-100 bg-transparent border-none cursor-pointer",
              "border-b-2",
              active
                ? "border-b-[var(--color-brand)] text-[var(--ds-gray-1000)]"
                : "border-b-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-900)]",
              disabled && "opacity-40 cursor-not-allowed"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

Tabs.displayName = "Tabs";

export { Tabs };
