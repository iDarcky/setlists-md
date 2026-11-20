import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeTabs } from '@/features/song-edit/SwipeTabs';
import { StartChart } from '@/features/song-edit/StartChart';
import { NewSongSheet } from '@/features/songs/NewSongSheet';
import { sameSongLine, EMPTY_DETAILS } from '@/features/song-edit/newSongDetails';

describe('SwipeTabs', () => {
  const setup = (onIndex = vi.fn()) => {
    render(<SwipeTabs labels={['Chart', 'Info']} index={0} onIndex={onIndex} pages={[<p key="c">chart page</p>, <p key="i">info page</p>]} />);
    return onIndex;
  };
  it('a sideways swipe moves to the next page', () => {
    const onIndex = setup();
    const page = screen.getByText('chart page');
    fireEvent.touchStart(page, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchMove(page, { touches: [{ clientX: 150, clientY: 105 }] });
    fireEvent.touchEnd(page, { touches: [] });
    expect(onIndex).toHaveBeenCalledWith(1);
  });
  it('a scroll down does not', () => {
    const onIndex = setup();
    const page = screen.getByText('chart page');
    fireEvent.touchStart(page, { touches: [{ clientX: 200, clientY: 300 }] });
    fireEvent.touchMove(page, { touches: [{ clientX: 180, clientY: 100 }] });
    fireEvent.touchEnd(page, { touches: [] });
    expect(onIndex).not.toHaveBeenCalled();
  });
  it('tapping a tab switches', () => {
    const onIndex = setup();
    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(onIndex).toHaveBeenCalledWith(1);
  });
});

describe('StartChart', () => {
  it('phone: Paste the song and Write it', () => {
    const onWrite = vi.fn();
    render(<StartChart wide={false} onPaste={vi.fn()} onWrite={onWrite} />);
    expect(screen.getByRole('button', { name: 'Paste the song' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Write it' }));
    expect(onWrite).toHaveBeenCalled();
  });
  it('desktop: pasting anywhere sends the text', () => {
    const onPaste = vi.fn();
    render(<StartChart wide onPaste={onPaste} onWrite={vi.fn()} />);
    const e = new Event('paste', { bubbles: true, cancelable: true });
    e.clipboardData = { getData: () => 'G\nAmazing grace' };
    document.dispatchEvent(e);
    expect(onPaste).toHaveBeenCalledWith('G\nAmazing grace');
  });
});

describe('New song details', () => {
  it('time starts on 4/4', () => expect(EMPTY_DETAILS.time).toBe('4/4'));
  it('says which song you already have, with its key', () => {
    expect(sameSongLine({ title: 'Oceans', artist: 'Hillsong United', arrangements: [{ key: 'D' }] })).toBe('You already have Oceans by Hillsong United, in D.');
  });
  it('the sheet has no More, and Next stays off until it is filled', () => {
    render(<NewSongSheet open onOpenChange={vi.fn()} onNext={vi.fn()} initialTitle="Oceans" />);
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next: Chart' })).toBeDisabled();
    expect(screen.getByDisplayValue('Oceans')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4/4' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Import: a scanned PDF', () => {
  it('says it is a photo and offers to paste the words', async () => {
    const { ImportScanSheet } = await import('@/features/songs/ImportScanSheet');
    const onPaste = vi.fn();
    render(<ImportScanSheet open scans={['Viața mea.pdf']} readCount={5} onSkip={vi.fn()} onPaste={onPaste} />);
    expect(screen.getByText('Viața mea.pdf is a photo of a page.')).toBeInTheDocument();
    expect(screen.getByText('The other 5 songs were read. You’ll see them next.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Paste the words instead' }));
    expect(onPaste).toHaveBeenCalledWith('Viața mea.pdf');
  });
  it('finds the scans among the failed files', async () => {
    const { scannedFiles } = await import('@/lib/importFiles');
    expect(scannedFiles(['a.pdf (scanned image — no text to read)', 'b.txt'])).toEqual(['a.pdf']);
  });
});
