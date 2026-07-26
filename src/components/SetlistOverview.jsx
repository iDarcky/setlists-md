import SetlistOverviewV2 from './SetlistOverviewV2';
import SetlistViewerCards from './SetlistViewerCards';

// The card-language viewer graduated from Labs (2026-07) and is now the
// default. `cards={false}` still selects the previous V2 overview — kept as an
// escape hatch until that path is deleted. (The old v1 was removed; the `v2`
// prop is accepted but ignored.)
export default function SetlistOverview({ cards = true, ...props }) {
  if (cards) return <SetlistViewerCards {...props} />;
  return <SetlistOverviewV2 {...props} />;
}
