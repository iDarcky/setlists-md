import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Left padding that slides a list card's content clear of the SelectCircle:
// full when selection mode is active, on hover otherwise (so it animates in).
export function selectPad(selectable, active) {
  if (!selectable) return '';
  return active ? 'pl-9' : 'group-hover:pl-9';
}
