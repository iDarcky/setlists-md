import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { bandFor } from '@/lib/homeData';
import SetlistEdit from './SetlistEdit';

// Edit's container: who can lead a song is the band on this setlist (anyone
// who has not said no), or, with no band yet, everyone in the church.

function nameFor(members, uid, myId) {
  const m = members.find(x => x.user_id === uid);
  return m?.profile?.display_name || m?.profile?.email?.split('@')[0] || (uid === myId ? 'You' : 'Member');
}

export default function SetlistEditPage({ setlist, schedules = [], setlistMap = {}, ...rest }) {
  const { user } = useAuth();
  const { team, members = [] } = useTeam();
  const nameOf = (uid) => nameFor(members, uid, user?.id);
  const band = team ? bandFor(setlist, schedules, setlistMap).filter(r => r.availability !== 'unavailable') : [];
  const ids = band.length ? [...new Set(band.map(r => r.user_id))] : members.map(m => m.user_id);
  const people = ids.map(id => ({ id, name: nameOf(id) }));
  return <SetlistEdit setlist={setlist} people={people} nameOf={nameOf} {...rest} />;
}
