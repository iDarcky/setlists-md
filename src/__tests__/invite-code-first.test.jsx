import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InviteTeamView } from '@/features/intro/IntroStartViews';
import { InviteCard } from '@/features/team/TeamPage';
import { inviteMessage } from '@/lib/joinLink';

const url = 'https://app.setlists.md/join/abc123';

describe('invite: the code first, the link only inside Share invite', () => {
  it('Invite your team shows the code and no link', () => {
    render(<InviteTeamView code="abc123" url={url} onCopy={vi.fn()} onShare={vi.fn()} onLater={vi.fn()} />);
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy code/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Share invite/ })).toBeTruthy();
    expect(screen.queryByText(/app\.setlists\.md/)).toBeNull();
  });

  it('the team page card shows the code and no link', () => {
    render(<InviteCard teamName="Grace" code="abc123" url={url} />);
    expect(screen.getByText('ABC123')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Share invite/ })).toBeTruthy();
    expect(screen.queryByText(/app\.setlists\.md/)).toBeNull();
  });

  it('the shared message leads with the code', () => {
    expect(inviteMessage('Grace', 'abc123')).toBe('Join Grace on Setlists.md with the code ABC123, or tap the link:');
  });
});
