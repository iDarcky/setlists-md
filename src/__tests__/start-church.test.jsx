// Home, for an account with no church: the card, the request form, and the
// "we're setting it up" state after sending.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StartChurchCard, StartChurchSheet } from '@/features/home/StartChurch';

beforeAll(() => {
  window.matchMedia ||= () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});

function Host({ onSend }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(null);
  return (
    <>
      <StartChurchCard sent={sent} onStart={() => setOpen(true)} />
      {!sent && <StartChurchSheet open={open} onOpenChange={setOpen} email="ana@example.com"
        onSend={async (v) => { await onSend(v); setSent({ church: v.church }); }} />}
    </>
  );
}

describe('StartChurch', () => {
  it('asks for the name and place, then shows the request as sent', async () => {
    const onSend = vi.fn(async () => {});
    render(<Host onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask to start a church' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send request' }));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Add the name your band knows it by.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Church or band name'), { target: { value: 'Grace Chapel' } });
    fireEvent.change(screen.getByLabelText('Town and country'), { target: { value: 'Cluj, Romania' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ church: 'Grace Chapel', place: 'Cluj, Romania' })));
    expect(await screen.findByText('We’re setting up Grace Chapel')).toBeTruthy();
  });

  it('keeps the form open and says so when sending fails', async () => {
    render(<Host onSend={async () => { throw new Error('No connection'); }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask to start a church' }));
    fireEvent.change(await screen.findByLabelText('Church or band name'), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText('Town and country'), { target: { value: 'Y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('No connection')).toBeTruthy();
  });
});
