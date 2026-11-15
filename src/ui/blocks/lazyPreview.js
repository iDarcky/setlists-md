import { lazy } from 'react';

// `?blocks` shows the Bencho blocks on their own, for trying them on a phone
// (BlocksPreview.jsx). Lazy, so the app's own bundle does not grow.
export const BlocksPreview = lazy(() => import('./BlocksPreview'));
export const showBlocks = new URLSearchParams(window.location.search).has('blocks');
