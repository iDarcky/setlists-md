import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { bandFor } from '@/lib/homeData';
import SetlistFlow from './SetlistFlow';

// New setlist and Edit's container (canvas → New setlist v2): who can lead a
// song is a singer on this setlist's band — asked (and not said no) or, on a
// new setlist, planned.

const SINGS = /vocal|lead|sing/i;

function nameFor(members, uid, myId) {
  const m = members.find(x => x.user_id === uid);
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || (uid === myId ? 'You' : 'Member');
}

export default function SetlistEditPage({ setlist, schedules = [], setlistMap = {}, ...rest }) {
  const { user } = useAuth();
  const { team, members = [] } = useTeam();
  const nameOf = (uid) => nameFor(members, uid, user?.id);
  // Only the singers picked for this band can lead (owner, 2026-11-04): none
  // picked yet → nobody, until someone is.
  const peopleOf = (sl) => {
    const band = team ? bandFor(sl, schedules, setlistMap).filter(r => r.availability !== 'unavailable' && SINGS.test(r.role || '')).map(r => r.user_id) : [];
    const planned = (sl.plannedBand || []).filter(a => a.userId && SINGS.test(a.part || '')).map(a => a.userId);
    return [...new Set([...band, ...planned])].map(id => ({ id, name: nameOf(id) }));
  };

  return (
    <SetlistFlow setlist={setlist} peopleOf={peopleOf} nameOf={nameOf}
      team={team} members={members} schedules={schedules} setlistMap={setlistMap} {...rest} />
  );
}
