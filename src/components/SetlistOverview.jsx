import SetlistOverviewV2 from './SetlistOverviewV2';
import SetlistViewerCards from './SetlistViewerCards';

// The redesigned overview graduated from Labs and is now the default. When the
// `cards` Labs flag is on, the card-language viewer is used instead. (The old
// v1 was removed; the `v2` prop is accepted but ignored.)
export default function SetlistOverview({ cards = false, ...props }) {
  if (cards) return <SetlistViewerCards {...props} />;
  return <SetlistOverviewV2 {...props} />;
}
