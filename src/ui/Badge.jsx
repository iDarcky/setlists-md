import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)]",
    secondary: "border-transparent bg-[var(--ds-gray-200)] text-[var(--ds-gray-1000)]",
    outline: "text-[var(--ds-gray-900)] border-[var(--ds-gray-200)]",
    success: "bg-[var(--ds-success-soft)] text-[var(--ds-success-900)] border-[var(--ds-success-border)]",
    error: "bg-[var(--ds-error-soft)] text-[var(--ds-error-900)] border-[var(--ds-error-border)]",
    warning: "bg-[var(--ds-warning-soft)] text-[var(--ds-warning-900)] border-[var(--ds-warning-border)]",
    brand: "bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]",
  }

  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ds-gray-400)] focus:ring-offset-2", variants[variant], className)} {...props} />
  )
}

export { Badge }
