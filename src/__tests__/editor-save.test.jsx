// Editor save path — the first render tests in the codebase.
//
// This file exists because of a specific history: four data-loss bugs shipped
// in one cycle (0.17.0-beta.2) and every one was found by a user, not the
// suite. All four were the same shape — the editor rendered fine, the user hit
// Save, and content silently did not survive the round trip. 619 pure-logic
// tests could not see any of them, because none of them mount the editor.
//
// So these assert the one thing that matters most: what the editor hands to
// onSave still contains what the user typed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Editor from '@/features/editor/Editor';
import { songFromFlat } from '@/arrangements';
import { songToMd } from '@/parser';

// The editor's confirm() falls back to window.confirm with no provider.
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

function makeSong() {
  return songFromFlat({
    id: 'song-1',
    title: 'Ce mare esti',
    artist: 'Test Artist',
    key: 'G',
    tempo: 72,
    time: '4/4',
    sections: [
      { type: 'Verse', name: 'Verse 1', lines: ['[G]Ce mare esti, [C]Doamne'] },
      { type: 'Chorus', name: 'Chorus', lines: ['[D]Slava Tie, [Em]Rege sfant'] },
    ],
  });
}

const saveButton = () => screen.getByRole('button', { name: 'Save' });

/**
 * Click Save once the editor has actually registered the edit.
 *
 * The editor regenerates its markdown from the working song asynchronously, so
 * Save is still disabled for a tick after typing — clicking immediately is a
 * silent no-op that looks like "save is broken".
 */
async function save(user) {
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await user.click(saveButton());
}

/** What the editor handed to onSave, as markdown — i.e. what would persist. */
async function savedMd(onSave) {
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  return songToMd(onSave.mock.calls.at(-1)[0]);
}

describe('Editor — save preserves content', () => {
  it('keeps every lyric line when only the title is edited', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Editor song={makeSong()} onSave={onSave} onBack={vi.fn()} />);

    // Make it dirty — Save stays disabled otherwise.
    const title = screen.getByDisplayValue('Ce mare esti');
    await user.clear(title);
    await user.type(title, 'Ce mare esti Tu');

    await save(user);

    const md = await savedMd(onSave);
    // The lyrics the user never touched must survive untouched.
    expect(md).toContain('Ce mare esti, [C]Doamne');
    expect(md).toContain('Slava Tie, [Em]Rege sfant');
    expect(md).toContain('Ce mare esti Tu');
  });

  it('does not stamp parser defaults over real metadata', async () => {
    // Regression: the chart canvas rewrote the whole frontmatter on every
    // edit, stamping the parser's `Untitled` / `C` defaults onto the song.
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<Editor song={makeSong()} onSave={onSave} onBack={vi.fn()} />);

    const title = screen.getByDisplayValue('Ce mare esti');
    await user.type(title, '!');
    await save(user);

    const md = await savedMd(onSave);
    expect(md).not.toContain('Untitled');
    expect(md).toMatch(/^key: G$/m);
    expect(md).toMatch(/^artist: Test Artist$/m);
  });

  it('cannot save an unchanged song', () => {
    // Save is gated on isDirty. A no-op save is how a stale working copy
    // overwrites a newer one.
    render(<Editor song={makeSong()} onSave={vi.fn()} onBack={vi.fn()} />);
    expect(saveButton()).toBeDisabled();
  });
});
