// The "after sign-up" screens: when they show, and the flow through them.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { startScreen, storedRequest, inviteCodeFrom } from '@/lib/startFlow';
import { churchRequestText, CHURCH_REQUEST_TAG, rememberChurchRequest, finishChurchRequest, forgetChurchRequest, sentChurchRequest } from '@/lib/churchRequest';

const sent = vi.fn(async () => ({ id: 't1' }));
vi.mock('@/auth/useTeam', () => ({ useTeam: () => ({ createTeam: (...a) => sent(...a) }) }));
const rpc = vi.fn(async () => ({ data: ['keys'], error: null }));
vi.mock('@/auth/supabase', () => ({ supabase: {
  auth: { updateUser: vi.fn(async () => ({})) },
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'm1' }, error: null }) }) }) }) }),
  rpc: (...a) => rpc(...a),
} }));
const api = { peekJoinLink: vi.fn(), getTeamJoinLink: vi.fn(async () => ({ code: 'k7m2qx', enabled: true })) };
vi.mock('@/features/join/joinApi', () => ({
  peekJoinLink: (...a) => api.peekJoinLink(...a),
  getTeamJoinLink: (...a) => api.getTeamJoinLink(...a),
}));
vi.mock('@/features/start/GetAppScreen', () => ({
  default: ({ teamName, onOpen }) => <button type="button" onClick={onOpen}>Open {teamName}</button>,
}));

const { default: StartFlow } = await import('@/features/start/StartFlow');

beforeAll(() => {
  window.matchMedia ||= () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
beforeEach(() => { localStorage.clear(); sent.mockClear(); });

const base = { signedIn: true, teamsLoaded: true, teamCount: 0, pendingJoin: null, request: null, view: 'home' };

describe('startScreen', () => {
  it('asks the question when signed in with no church or band', () => {
    expect(startScreen(base)).toBe('choose');
  });
  it('stays out until teams load, when signed out, on auth and join screens, and with a parked join link', () => {
    expect(startScreen({ ...base, teamsLoaded: false })).toBe(null);
    expect(startScreen({ ...base, signedIn: false })).toBe(null);
    expect(startScreen({ ...base, view: 'join' })).toBe(null);
    expect(startScreen({ ...base, view: 'signin' })).toBe(null);
    expect(startScreen({ ...base, pendingJoin: { code: 'abcdefgh', stage: 'requested' } })).toBe(null);
  });
  it('never waits: no group yet means choose, a new group shows ready once, then gets out of the way', () => {
    const request = { church: 'Grace', kind: 'church', at: 1 };
    expect(startScreen({ ...base, request })).toBe('choose');
    expect(startScreen({ ...base, request, teamCount: 1 })).toBe('ready');
    expect(startScreen({ ...base, request: { ...request, done: true }, teamCount: 1 })).toBe(null);
    expect(startScreen({ ...base, teamCount: 2 })).toBe(null);
  });
});

describe('storedRequest', () => {
  it('prefers this device, falls back to the account', () => {
    expect(storedRequest({ church: 'A' }, { start_request: { church: 'B' } })).toEqual({ church: 'A' });
    expect(storedRequest(null, { start_request: { church: 'B', kind: 'band', at: 5 } })).toEqual({ church: 'B', kind: 'band', at: 5, done: false });
    expect(storedRequest(null, { start_request: null })).toBe(null);
    expect(storedRequest(null, null)).toBe(null);
  });
});

describe('inviteCodeFrom', () => {
  it('reads a full link, a link without https, or a bare code', () => {
    expect(inviteCodeFrom('https://setlists.md/join/AbCdEfGh12')).toBe('abcdefgh12');
    expect(inviteCodeFrom('app.setlists.md/join/abcdefgh12/')).toBe('abcdefgh12');
    expect(inviteCodeFrom('  abcdefgh12 ')).toBe('abcdefgh12');
  });
  it('refuses anything else', () => {
    expect(inviteCodeFrom('')).toBe(null);
    expect(inviteCodeFrom('hello there')).toBe(null);
    expect(inviteCodeFrom('https://example.com/other/abcdefgh')).toBe(null);
  });
});

describe('churchRequest with a kind', () => {
  it('marks a band request, keeps the tag first', () => {
    const text = churchRequestText({ church: 'Fair band', place: 'Oradea', people: 'Up to 5', email: 'a@b.c', kind: 'band' });
    expect(text.startsWith(`${CHURCH_REQUEST_TAG} Fair band\nKind: band or small group\nWhere: Oradea`)).toBe(true);
  });
  it('remembers, finishes and forgets a request per account', () => {
    rememberChurchRequest('u1', 'Grace', localStorage, 'band');
    expect(sentChurchRequest('u1')).toMatchObject({ church: 'Grace', kind: 'band' });
    finishChurchRequest('u1');
    expect(sentChurchRequest('u1').done).toBe(true);
    forgetChurchRequest('u1');
    expect(sentChurchRequest('u1')).toBe(null);
  });
});

describe('StartFlow', () => {
  const user = { id: 'u1', email: 'joe@example.com', user_metadata: {} };

  it('join or create are two equal tiles; create asks the name, then makes it at once on Free', async () => {
    const onRequestChange = vi.fn();
    render(<StartFlow screen="choose" user={user} displayName="Joe Doe" request={null} onRequestChange={onRequestChange} />);
    expect(screen.getByText('Hi Joe, let’s get you set up')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Join a team/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Create a team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Add the name people know it by.')).toBeTruthy();
    expect(sent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Church or band name'), { target: { value: 'Grace Church' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(sent).toHaveBeenCalled());
    expect(sent.mock.calls[0][0]).toMatchObject({ name: 'Grace Church', location: null });
    expect(onRequestChange.mock.calls[0][0]).toMatchObject({ church: 'Grace Church' });
    await waitFor(() => expect(sentChurchRequest('u1')).toMatchObject({ church: 'Grace Church' }));
  });

  it('a failed create says why and clears the hand-up', async () => {
    sent.mockRejectedValueOnce(new Error('Network down'));
    const onRequestChange = vi.fn();
    render(<StartFlow screen="choose" user={user} request={null} onRequestChange={onRequestChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Create a team/ }));
    fireEvent.change(screen.getByLabelText('Church or band name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Network down')).toBeTruthy();
    expect(onRequestChange).toHaveBeenLastCalledWith(null);
  });

  it('a code: checks it, then opens the join flow; a wrong one says so', async () => {
    const onJoinCode = vi.fn();
    api.peekJoinLink.mockResolvedValueOnce({ status: 'invalid' }).mockResolvedValueOnce({ status: 'ok', team_name: 'Grace' });
    render(<StartFlow screen="choose" user={user} request={null} onJoinCode={onJoinCode} />);
    fireEvent.click(screen.getByRole('button', { name: /Join a team/ }));
    const field = screen.getByLabelText('Invite code, 6 characters');
    fireEvent.change(field, { target: { value: 'ZZZ-ZZZ' } });
    expect(await screen.findByText(/doesn’t match a team/)).toBeTruthy();
    expect(api.peekJoinLink).toHaveBeenCalledWith('zzzzzz');
    expect(onJoinCode).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Invite code, 6 characters').value).toBe(''), { timeout: 3000 });
    fireEvent.change(screen.getByLabelText('Invite code, 6 characters'), { target: { value: 'k7m2qx' } });
    await waitFor(() => expect(onJoinCode).toHaveBeenCalledWith('k7m2qx'));
  });

  it('a pasted link: opens the join flow with the code, or says the link is wrong', () => {
    const onJoinCode = vi.fn();
    render(<StartFlow screen="choose" user={user} request={null} onJoinCode={onJoinCode} />);
    fireEvent.click(screen.getByRole('button', { name: /Join a team/ }));
    fireEvent.click(screen.getByRole('button', { name: /Paste it/ }));
    const input = screen.getByLabelText('Invite link');
    fireEvent.change(input, { target: { value: 'nope nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/doesn’t look like an invite link/)).toBeTruthy();
    fireEvent.change(input, { target: { value: 'setlists.md/join/abcdefgh12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoinCode).toHaveBeenCalledWith('abcdefgh12');
  });

  it('after creating: what you play, the invite code, the app, then never again', async () => {
    const onOpenTeam = vi.fn();
    const onRequestChange = vi.fn();
    rememberChurchRequest('u1', 'Grace Church');
    render(<StartFlow screen="ready" user={user} request={{ church: 'Grace Church' }} team={{ id: 't1', name: 'Grace Church' }}
      onOpenTeam={onOpenTeam} onRequestChange={onRequestChange} />);
    expect(screen.getByText('What do you play?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keys' }));
    expect(screen.getByRole('button', { name: /Keys/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Invite your team')).toBeTruthy();
    // Sound desk and slides aren't instruments; Keys is saved on the leader's row.
    expect(rpc).toHaveBeenCalledWith('set_member_instruments', { p_member_id: 'm1', p_instruments: ['keys'] });
    expect(await screen.findByText('K7M2QX')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Later|Continue/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Grace Church' }));
    expect(onOpenTeam).toHaveBeenCalledWith('t1');
    expect(onRequestChange.mock.calls[0][0]).toMatchObject({ done: true });
    expect(sentChurchRequest('u1').done).toBe(true);
  });
});
