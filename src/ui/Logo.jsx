import React from 'react';

export const Logo = ({ size = 32, variant = 'full', className = '' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Abstract 'MD' + Setlist Symbol */}
        <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--color-brand)" fillOpacity="0.1" />
        <path d="M7 8H17" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 12H17" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 16H11" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17" cy="16" r="2" stroke="var(--color-brand)" strokeWidth="2" />
      </svg>
      {variant === 'full' && (
        <span className="text-heading-18 font-bold tracking-tight text-[var(--text-1)]">
          Setlists<span className="text-[var(--color-brand)]">MD</span>
        </span>
      )}
    </div>
  );
};
