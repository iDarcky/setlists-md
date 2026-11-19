import { useContext } from 'react';
import { TeamContext } from '@/auth/TeamContext';
import { wordsFor } from '@/lib/spaceWords';

/** Church or band words for the open group (see lib/spaceWords). Safe
 *  outside a TeamProvider (render tests, previews): reads as a band. */
export function useSpaceWords() {
  const ctx = useContext(TeamContext);
  return wordsFor(ctx?.team);
}
