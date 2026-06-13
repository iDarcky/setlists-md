import React, { useRef, useState, useImperativeHandle } from 'react';
import { cn } from '../../lib/utils';

/**
 * ButtonLoading component (Internal)
 */
const ButtonLoading = ({ color }) => (
  <span className="flex items-center justify-center mr-2 shrink-0">
    <svg 
      className="animate-spin" 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ color }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </span>
);

/**
 * ButtonDrip component (Internal)
 */
const ButtonDrip = ({ x, y, color, onCompleted }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onCompleted();
    }, 400);
    return () => clearTimeout(timer);
  }, [onCompleted]);

  return (
    <span 
      className="absolute bg-white/20 rounded-full animate-drip pointer-events-none z-0"
      style={{ 
        left: x, 
        top: y, 
        width: '1px', 
        height: '1px',
        backgroundColor: color || 'rgba(255, 255, 255, 0.25)'
      }} 
    />
  );
};

/**
 * Button2 Component
 * Ported from Geist UI source
 */
const Button2 = React.forwardRef(({
  children,
  type = 'default',
  ghost = false,
  loading = false,
  shadow = false,
  auto = false,
  effect = true,
  disabled = false,
  htmlType = 'button',
  icon,
  iconRight,
  onClick,
  className,
  ...props
}, ref) => {
  const buttonRef = useRef(null);
  useImperativeHandle(ref, () => buttonRef.current);

  const [dripShow, setDripShow] = useState(false);
  const [dripX, setDripX] = useState(0);
  const [dripY, setDripY] = useState(0);

  const clickHandler = (event) => {
    if (disabled || loading) return;
    
    // Performance: Drip calculation
    const isDripAllowed = !shadow && !ghost && effect;
    if (isDripAllowed && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDripShow(true);
      setDripX(event.clientX - rect.left);
      setDripY(event.clientY - rect.top);
    }

    onClick && onClick(event);
  };

  const dripCompletedHandle = () => {
    setDripShow(false);
    setDripX(0);
    setDripY(0);
  };

  // Variant Styles Mapping
  const variants = {
    default: "bg-[var(--bg-1)] text-[var(--text-1)] border-[var(--border-1)] hover:bg-[var(--bg-2)] hover:border-[var(--border-2)]",
    primary: "bg-[var(--text-1)] text-[var(--bg-1)] border-[var(--text-1)] hover:bg-[var(--text-2)] hover:border-[var(--text-2)]",
    success: "bg-[var(--ds-teal-900)] text-white border-[var(--ds-teal-900)] hover:opacity-90",
    warning: "bg-[var(--ds-amber-900)] text-white border-[var(--ds-amber-900)] hover:opacity-90",
    error: "bg-[var(--ds-red-900)] text-white border-[var(--ds-red-900)] hover:opacity-90",
    abort: "bg-transparent text-[var(--text-2)] border-transparent hover:bg-[var(--bg-2)]",
  };

  // Ghost Override
  const ghostStyles = ghost ? {
    default: "bg-transparent text-[var(--text-1)] border-[var(--border-1)] hover:bg-[var(--text-1)] hover:text-[var(--bg-1)]",
    primary: "bg-transparent text-[var(--text-1)] border-[var(--text-1)] hover:bg-[var(--text-1)] hover:text-[var(--bg-1)]",
    success: "bg-transparent text-[var(--ds-teal-900)] border-[var(--ds-teal-900)] hover:bg-[var(--ds-teal-900)] hover:text-white",
    error: "bg-transparent text-[var(--ds-red-900)] border-[var(--ds-red-900)] hover:bg-[var(--ds-red-900)] hover:text-white",
  }[type] || "" : "";

  return (
    <button
      ref={buttonRef}
      type={htmlType}
      disabled={disabled || loading}
      onClick={clickHandler}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden transition-all duration-200 ease-in-out font-medium select-none outline-none",
        "h-10 px-4 rounded-md border text-sm uppercase tracking-wide",
        auto ? "w-auto min-w-min" : "w-[160px]",
        variants[type],
        ghost && ghostStyles,
        shadow && "shadow-md hover:-translate-y-0.5 active:translate-y-0",
        (disabled || loading) && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      {...props}
    >
      {loading && <ButtonLoading color="currentColor" />}
      
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon && !loading && <span className="flex items-center">{icon}</span>}
        {children}
        {iconRight && <span className="flex items-center">{iconRight}</span>}
      </span>

      {dripShow && (
        <ButtonDrip
          x={dripX}
          y={dripY}
          onCompleted={dripCompletedHandle}
          color={type === 'default' || ghost ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.3)'}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drip {
          from { opacity: 0.8; transform: scale(1); }
          to { opacity: 0; transform: scale(400); }
        }
        .animate-drip {
          animation: drip 400ms ease-out;
        }
      `}} />
    </button>
  );
});

Button2.displayName = 'Button2';

export { Button2 };
