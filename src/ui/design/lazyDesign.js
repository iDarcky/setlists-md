import { lazy } from 'react';

// `?design` shows the design system's foundations and components on one page,
// for checking them on a real phone in both themes. Lazy, so the app's own
// bundle does not grow.
export const DesignPreview = lazy(() => import('./DesignPreview'));
export const showDesign = new URLSearchParams(window.location.search).has('design');
