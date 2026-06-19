import SetlistOverviewV2 from './SetlistOverviewV2';

// The redesigned overview graduated from Labs and is now the only version.
// (The previous v1 implementation was removed; the `v2` prop is accepted but
// ignored for backward-compatibility with existing call sites.)
export default function SetlistOverview(props) {
  return <SetlistOverviewV2 {...props} />;
}
