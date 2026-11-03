import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's own scale, so it would read our text
// sizes (src/styles/ds.css) as colours and drop `text-foreground` next to
// `text-title`. Teach it the five sizes and the three corners.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'body', 'small', 'caption'] }],
      rounded: [{ rounded: ['control', 'card', 'sheet'] }],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
