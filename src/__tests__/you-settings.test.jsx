// The You page and Settings after the 2026-11-14 rework: the church is the
// title, Subscription is the owner's, the version unlocks Labs after 7 taps,
// reminders are rows you add and remove, and feedback goes through a form.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import YouPage from '@/features/you/YouPage';
import FeedbackSheet from '@/features/you/FeedbackSheet';
import { SettingsHubView, NotificationsSettingsView, DateTimeView } from '@/features/settings/SettingsViews';
import { webPageUrl } from '@/features/legal/WebSheet';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  }
});

const me = { name: 'Joe Doe', email: 'joe@example.com' };

describe('You page', () => {
  it('puts the church in the title and you under it', () => {
    render(<YouPage me={me} church={{ name: 'Grace Church', role: 'Leader', people: 14 }} onTeam={() => {}} onSettings={() => {}} version="1.0.0" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Grace Church');
    expect(screen.getByText('Joe Doe')).toBeTruthy();
    expect(screen.getByText('Leader')).toBeTruthy();
    expect(screen.getByText('14 people')).toBeTruthy();
  });

  it('is titled with your name when there is no church', () => {
    render(<YouPage me={me} onSettings={() => {}} version="1.0.0" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Joe Doe');
  });

  it('shows Subscription only when given one (the owner)', () => {
    const { rerender } = render(<YouPage me={me} church={{ name: 'Grace' }} onSubscription={() => {}} version="1.0.0" />);
    expect(screen.queryByText('Subscription')).toBeNull();
    rerender(<YouPage me={me} church={{ name: 'Grace' }} subscription={{ label: 'Band' }} onSubscription={() => {}} version="1.0.0" />);
    expect(screen.getByText('Subscription')).toBeTruthy();
    expect(screen.getByText('Band')).toBeTruthy();
  });

  it('has no About, Help-and-feedback or Design system rows any more', () => {
    render(<YouPage me={me} version="1.0.0" />);
    expect(screen.queryByText('About')).toBeNull();
    expect(screen.queryByText('Help and feedback')).toBeNull();
    expect(screen.queryByText('Design system')).toBeNull();
    expect(screen.getByText('Help')).toBeTruthy();
    expect(screen.getByText('Send feedback')).toBeTruthy();
    expect(screen.getByText('Privacy and terms')).toBeTruthy();
  });

  it('unlocks Labs after 7 quick taps on the version, not before', () => {
    const onUnlockLabs = vi.fn();
    render(<YouPage me={me} version="1.0.0" onUnlockLabs={onUnlockLabs} />);
    const v = screen.getByText(/version 1\.0\.0/);
    for (let i = 0; i < 6; i++) fireEvent.click(v);
    expect(onUnlockLabs).not.toHaveBeenCalled();
    expect(screen.getByText('1 more tap to turn on Labs')).toBeTruthy();
    fireEvent.click(v);
    expect(onUnlockLabs).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Labs is on. Find it in Settings.')).toBeTruthy();
  });

  it('starts the count again after a pause', () => {
    const onUnlockLabs = vi.fn();
    const now = vi.spyOn(Date, 'now');
    render(<YouPage me={me} version="1.0.0" onUnlockLabs={onUnlockLabs} />);
    const v = screen.getByText(/version 1\.0\.0/);
    let t = 1_000_000;
    for (let i = 0; i < 4; i++) { now.mockReturnValue(t += 200); fireEvent.click(v); }
    now.mockReturnValue(t += 10_000);
    for (let i = 0; i < 4; i++) { fireEvent.click(v); now.mockReturnValue(t += 200); }
    expect(onUnlockLabs).not.toHaveBeenCalled();
    now.mockRestore();
  });
});

describe('Settings hub', () => {
  it('hides Labs until it is unlocked', () => {
    const { rerender } = render(<SettingsHubView onOpen={() => {}} />);
    expect(screen.queryByText('Labs')).toBeNull();
    expect(screen.getByText('Date and time')).toBeTruthy();
    expect(screen.queryByText('Appearance')).toBeNull();
    expect(screen.queryByText('Plan and billing')).toBeNull();
    rerender(<SettingsHubView onOpen={() => {}} labs />);
    expect(screen.getAllByText('Labs').length).toBeGreaterThan(0);
  });

  it('shows the church rows to leaders only', () => {
    const { rerender } = render(<SettingsHubView onOpen={() => {}} />);
    expect(screen.queryByText('Templates')).toBeNull();
    rerender(<SettingsHubView onOpen={() => {}} church={{ name: 'Grace' }} />);
    expect(screen.getByText('Templates')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
  });
});

describe('Date and time', () => {
  it('says 12-hour and 24-hour, no examples, and has no theme', () => {
    render(<DateTimeView />);
    expect(screen.getByRole('radio', { name: '12-hour' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '24-hour' })).toBeTruthy();
    expect(screen.queryByText('Theme')).toBeNull();
  });
});

describe('Reminders', () => {
  const options = [
    { value: 0, long: 'When it starts' },
    { value: 60, long: '1 hour before' },
    { value: 1440, long: '1 day before' },
  ];

  it('lists each reminder, furthest ahead first, and removes one with ✕', () => {
    const onServiceReminders = vi.fn();
    render(<NotificationsSettingsView reminderOptions={options} serviceReminders={[60, 1440]} onServiceReminders={onServiceReminders} rehearsalReminders={[]} />);
    const rows = screen.getAllByText(/before$/).map(n => n.textContent);
    expect(rows.slice(0, 2)).toEqual(['1 day before', '1 hour before']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1 hour before' }));
    expect(onServiceReminders).toHaveBeenCalledWith([1440]);
  });

  it('adds only a time you do not have yet, in time order', () => {
    const onServiceReminders = vi.fn();
    render(<NotificationsSettingsView reminderOptions={options} serviceReminders={[1440]} onServiceReminders={onServiceReminders} rehearsalReminders={[0, 60, 1440]} />);
    // The rehearsal list is full: one "Add reminder", the service's.
    const adds = screen.getAllByRole('button', { name: 'Add reminder' });
    expect(adds.length).toBe(1);
    fireEvent.click(adds[0]);
    expect(screen.queryAllByRole('button', { name: '1 day before' }).length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '1 hour before' }));
    expect(onServiceReminders).toHaveBeenCalledWith([60, 1440]);
  });
});

describe('Send feedback', () => {
  it('sends the kind and the text, then thanks you', async () => {
    const send = vi.fn().mockResolvedValue();
    render(<FeedbackSheet open onOpenChange={() => {}} userId="u1" send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'An idea' }));
    fireEvent.change(screen.getByLabelText('Tell us'), { target: { value: '  A metronome please  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Thank you. We read every one.')).toBeTruthy());
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', type: 'feature', description: 'A metronome please' }));
  });

  it('will not send an empty message', () => {
    const send = vi.fn();
    render(<FeedbackSheet open onOpenChange={() => {}} send={send} />);
    expect(screen.getByRole('button', { name: 'Send' }).disabled).toBe(true);
  });
});

describe('Website pages', () => {
  it('opens inside the app with ?app=1 and in the browser without it', () => {
    expect(webPageUrl('help', { inApp: true })).toBe('https://setlists.md/help?app=1');
    expect(webPageUrl('privacy')).toBe('https://setlists.md/privacy');
  });
});
