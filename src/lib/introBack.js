// How many screens with "← Back" are up (AuthLayout). While one is, a
// browser/phone back belongs to it, not to the app's own history: App's
// popstate handler checks introBackOwnsHistory() (QA 21 Nov: Back from Join
// or create also popped the app back to Log in).
let backScreens = 0;

export function claimBack() { backScreens += 1; }
export function releaseBack() { backScreens = Math.max(0, backScreens - 1); }
export function introBackOwnsHistory() { return backScreens > 0; }
