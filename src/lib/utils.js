import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Left padding that slides a list card's content clear of the SelectCircle —
// only in selection mode (no hover-reveal, so the row doesn't shift on hover).
export function selectPad(selectable, active) {
  if (!selectable || !active) return '';
  return 'pl-9';
}
