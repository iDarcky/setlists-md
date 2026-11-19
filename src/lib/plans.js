// The three plans a church or band can be on (decided 2026-11-19).
//
// The plan lives on the group (`teams.plan`), never on a person. Seats are
// the hard limit and the database enforces them (`teams.max_seats`); this file
// only describes the plans for the screens. Changing a group's plan is done
// by hand for now (no payments yet), with a SQL file in supabase/migrations.
//
// `team` is the database key for Band (older rows already use it).

export const PLANS = {
  free: { key: 'free', label: 'Free', seats: 5, price: null, blurb: 'Songs and setlists for up to 5 people.' },
  team: { key: 'team', label: 'Band', seats: 15, price: '€9.99 a month', blurb: 'Songs and setlists for up to 15 people.' },
  church: {
    key: 'church', label: 'Church', seats: 40, price: '€19.99 a month',
    blurb: 'Up to 40 people, plus the schedule and services.',
    extra: '€5 a month for each 10 more people',
  },
};

export const PLAN_ORDER = ['free', 'team', 'church'];

/** A group's plan key, with anything unknown read as Free. */
export function planKeyOf(plan) {
  const k = (plan || 'free').toLowerCase();
  return PLANS[k] ? k : 'free';
}

export function planOf(plan) {
  return PLANS[planKeyOf(plan)];
}
