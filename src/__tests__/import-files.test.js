// @vitest-environment jsdom
// Every format the Import sheet promises ("ChordPro, OpenSong, .md, text, PDF,
// or a .zip of many songs") goes through parseImportFiles and comes back a song.
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

// pdf.js needs a worker and a real PDF; the conversion itself is covered by
// pdf-layout.test.js. Here only the routing matters.
vi.mock('@/lib/pdfChart', () => ({
  isPdfFile: (f) => /\.pdf$/i.test(f?.name || ''),
  pdfToChart: vi.fn(async () => ({
    md: '---\ntitle: Din PDF\nkey: G\n---\n\n## Verse 1\n[G]Cânt\n',
    warnings: ['No chord font detected — chords may be missing.'],
  })),
}));

const { parseImportFiles } = await import('@/lib/importFiles');

const file = (name, body) => new File([body], name);
const titles = (res) => res.songs.map(s => s.title);

const MD = '---\ntitle: Native\nkey: C\n---\n\n## Verse 1\n[C]Hello\n';
const CHORDPRO = '{title: Pro Song}\n{key: D}\n{start_of_verse}\n[D]Amazing [G]grace\n{end_of_verse}\n';
const OPENSONG = '<?xml version="1.0"?><song><title>Open Song</title><key>E</key><lyrics>[V1]\n.E      A\n Line one here\n</lyrics></song>';
const TEXT = 'Text Song\n\nVerse 1\nG        C\nAmazing grace how sweet\nD        G\nThat saved a wretch\n';

describe('parseImportFiles — every advertised format', () => {
  it('reads our own .md', async () => {
    expect(titles(await parseImportFiles([file('a.md', MD)]))).toEqual(['Native']);
  });

  it('reads ChordPro under each of its extensions', async () => {
    for (const ext of ['.cho', '.chopro', '.chordpro', '.pro', '.onsong']) {
      const res = await parseImportFiles([file(`s${ext}`, CHORDPRO)]);
      expect(titles(res), ext).toEqual(['Pro Song']);
      expect(res.songs[0].arrangements[0].sections[0].lines[0]).toContain('[D]');
    }
  });

  it('reads OpenSong .xml', async () => {
    const res = await parseImportFiles([file('s.xml', OPENSONG)]);
    expect(titles(res)).toEqual(['Open Song']);
  });

  it('reads plain text, chords above lyrics', async () => {
    const res = await parseImportFiles([file('s.txt', TEXT)]);
    expect(res.songs).toHaveLength(1);
    expect(JSON.stringify(res.songs[0].arrangements[0].sections)).toContain('[G]');
  });

  it('reads a PDF', async () => {
    expect(titles(await parseImportFiles([file('s.pdf', 'x')]))).toEqual(['Din PDF']);
  });

  it('reads a .zip of songs in mixed formats, PDFs included', async () => {
    const zip = new JSZip();
    zip.file('lib/a.md', MD);
    zip.file('lib/b.cho', CHORDPRO);
    zip.file('lib/c.pdf', 'x');
    zip.file('lib/d.pdf', 'x');
    zip.file('__MACOSX/lib/._a.md', 'junk');
    const blob = await zip.generateAsync({ type: 'uint8array' });
    const res = await parseImportFiles([file('library.zip', blob)]);
    expect(titles(res).sort()).toEqual(['Din PDF', 'Din PDF', 'Native', 'Pro Song']);
    expect(res.setlistFile).toBeNull();
    // The same converter warning from 2 PDFs is said once.
    expect(res.error.match(/chord font/g)).toHaveLength(1);
  });

  it('still hands a setlist bundle to the setlist importer', async () => {
    const zip = new JSZip();
    zip.file('setlist.json', '{}');
    zip.file('a.md', MD);
    const res = await parseImportFiles([file('set.zip', await zip.generateAsync({ type: 'uint8array' }))]);
    expect(res.setlistFile?.name).toBe('set.zip');
  });

  it('imports loose files of different kinds in one drop', async () => {
    const res = await parseImportFiles([file('a.md', MD), file('b.cho', CHORDPRO), file('c.pdf', 'x')]);
    expect(res.songs).toHaveLength(3);
  });
});
