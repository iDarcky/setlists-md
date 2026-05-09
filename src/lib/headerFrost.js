// Inline backdrop-filter for sticky headers using `material-header`.
//
// Lightning CSS strips the unprefixed `backdrop-filter` declaration when both
// `backdrop-filter` and `-webkit-backdrop-filter` are present in the same rule
// (it treats them as duplicates and keeps only the prefixed alias). Firefox
// and other non-WebKit engines don't honor `-webkit-backdrop-filter`, so the
// frost silently disappears. Setting both inline keeps the CSS bundler out of
// the way, the same trick FloatingNavPill uses.
export const headerFrostStyle = {
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
};
