// The "after sign-up" screens: when they show, and the flow through them.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { startScreen, storedRequest, inviteCodeFrom } from '@/lib/startFlow';
import { churchRequestText, CHURCH_REQUEST_TAG, rememberChurchRequest, finishChurchRequest, forgetChurchRequest, sentChurchRequest } from '@/lib/churchRequest';

const sent = vi.fn(async () => {});
vi.mock('@/lib/churchRequest', async (orig) => {
  const real = await orig();
  return { ...real, sendChurchRequest: (...a) => sent(...a) };
});
vi.mock('@/auth/supabase', () => ({ supabase: { auth: { updateUser: vi.fn(async () => ({})) } } }));

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
  it('waits after a request, shows ready once a church exists, then gets out of the way', () => {
    const request = { church: 'Grace', kind: 'church', at: 1 };
    expect(startScreen({ ...base, request })).toBe('waiting');
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

  it('church: asks, checks the fields, sends, and hands the request up', async () => {
    const onRequestChange = vi.fn();
    render(<StartFlow screen="choose" user={user} displayName="Joe Doe" request={null} onRequestChange={onRequestChange} />);
    expect(screen.getByText('Hi Joe, your account is ready. One more step.')).toBeTruthy();
    fireEvent.click(screen.getByText('A church'));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Add the name your church goes by.')).toBeTruthy();
    expect(sent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Church name'), { target: { value: 'Grace Church' } });
    fireEvent.change(screen.getByLabelText('City and country'), { target: { value: 'Cluj' } });
    fireEvent.click(screen.getByRole('button', { name: /11 to 30/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(onRequestChange).toHaveBeenCalled());
    expect(sent.mock.calls[0][1]).toMatchObject({ church: 'Grace Church', place: 'Cluj', people: '11 to 30', kind: 'church', userId: 'u1', email: 'joe@example.com' });
    expect(onRequestChange.mock.calls[0][0]).toMatchObject({ church: 'Grace Church', kind: 'church' });
    expect(sentChurchRequest('u1')).toMatchObject({ church: 'Grace Church' });
  });

  it('band: smaller sizes', () => {
    render(<StartFlow screen="choose" user={user} request={null} />);
    fireEvent.click(screen.getByText('A band or small group'));
    expect(screen.getByText('Tell us about your band')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Up to 5/ })).toBeTruthy();
  });

  it('invite link: opens the join flow with the code, or says the link is wrong', () => {
    const onJoinCode = vi.fn();
    render(<StartFlow screen="choose" user={user} request={null} onJoinCode={onJoinCode} />);
    fireEvent.click(screen.getByText('I have an invite link'));
    const input = screen.getByLabelText('Invite link');
    fireEvent.change(input, { target: { value: 'nope nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText(/doesn’t look like an invite link/)).toBeTruthy();
    fireEvent.change(input, { target: { value: 'setlists.md/join/abcdefgh12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onJoinCode).toHaveBeenCalledWith('abcdefgh12');
  });

  it('waiting: shows the church and lets them change the request', () => {
    const onRequestChange = vi.fn();
    rememberChurchRequest('u1', 'Grace Church');
    render(<StartFlow screen="waiting" user={user} request={{ church: 'Grace Church', kind: 'church', at: Date.now() }} onRequestChange={onRequestChange} />);
    expect(screen.getByText('Waiting for approval')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change the request' }));
    expect(onRequestChange).toHaveBeenCalledWith(null);
    expect(sentChurchRequest('u1')).toBe(null);
  });

  it('ready: invite or open, then never again', () => {
    const onInviteBand = vi.fn();
    const onRequestChange = vi.fn();
    rememberChurchRequest('u1', 'Grace Church');
    render(<StartFlow screen="ready" user={user} request={{ church: 'Grace Church', kind: 'church' }} team={{ id: 't1', name: 'Grace Church' }}
      onInviteBand={onInviteBand} onRequestChange={onRequestChange} />);
    expect(screen.getByText('Grace Church is ready')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Invite your band' }));
    expect(onInviteBand).toHaveBeenCalledWith('t1');
    expect(onRequestChange.mock.calls[0][0]).toMatchObject({ done: true });
    expect(sentChurchRequest('u1').done).toBe(true);
  });
});
