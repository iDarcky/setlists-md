import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { bandFor } from '@/lib/homeData';
import SetlistFlow from './SetlistFlow';

// New setlist and Edit's container (canvas → New setlist): who can lead a
// song is the band on this setlist — the people asked (anyone who has not
// said no) plus a new setlist's planned picks — or, with no band yet,
// everyone in the church.

function nameFor(members, uid, myId) {
  const m = members.find(x => x.user_id === uid);
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || (uid === myId ? 'You' : 'Member');
}

export default function SetlistEditPage({ setlist, schedules = [], setlistMap = {}, ...rest }) {
  const { user } = useAuth();
  const { team, members = [] } = useTeam();
  const nameOf = (uid) => nameFor(members, uid, user?.id);
  const peopleOf = (sl) => {
    const band = team ? bandFor(sl, schedules, setlistMap).filter(r => r.availability !== 'unavailable').map(r => r.user_id) : [];
    const planned = (sl.plannedBand || []).map(a => a.userId).filter(Boolean);
    const ids = band.length || planned.length ? [...new Set([...band, ...planned])] : members.map(m => m.user_id);
    return ids.map(id => ({ id, name: nameOf(id) }));
  };
  return (
    <SetlistFlow setlist={setlist} peopleOf={peopleOf} nameOf={nameOf}
      team={team} members={members} schedules={schedules} setlistMap={setlistMap} {...rest} />
  );
}
