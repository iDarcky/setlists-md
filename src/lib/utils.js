import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Left padding that slides a list card's content clear of the SelectCircle —
// only in selection mode (no hover-reveal, so the row doesn't shift on hover).
export function selectPad(selectable, active) {
  if (!selectable || !active) return '';
  // The circle sits at left-4 (16px) and is 22px wide, so it ends at 38px.
  // pl-9 (36px) put the row's content *under* it — pl-12 leaves a real gap.
  return 'pl-12';
}
