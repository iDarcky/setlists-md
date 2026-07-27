// Turn dropped/picked files into parsed songs (or a setlist bundle).
//
// Extracted out of the old ImportTab so the Add-a-song modal, the editor and
// any future drop target all agree on what a given file means.
import JSZip from 'jszip';
import { parseSongMd, generateId } from '@/parser';
import { songFromFlat } from '@/arrangements';
import { smartImport } from '@/importer';
import { pdfToChart, isPdfFile } from '@/import/pdfChart';

const CHORDPRO_EXTS = ['.cho', '.chopro', '.chord', '.crd', '.pro', '.onsong'];
export const IMPORT_ACCEPT = ['.md', '.zip', '.xml', '.txt', '.pdf', ...CHORDPRO_EXTS].join(',');

function ext(file) {
  const m = (file.name || '').toLowerCase().match(/\.[^.]+$/);
  return m ? m[0] : '';
}

function isZip(file) {
  return ext(file) === '.zip';
}

// Pick a converter from the extension. Returns the smartImport format key, or
// 'native' for our own .md. Unknown extensions fall back to auto-detect.
function detectFormatForFile(name) {
  const m = (name || '').toLowerCase().match(/\.[^.]+$/);
  const e = m ? m[0] : '';
  if (e === '.md') return 'native';
  if (e === '.xml') return 'opensong';
  if (CHORDPRO_EXTS.includes(e)) return 'chordpro';
  return null;
}

function readText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Convert one song's text into a song object. Throws if it can't be parsed.
function songFromText(text, name) {
  const fmt = detectFormatForFile(name);
  const md = fmt === 'native' ? text : smartImport(text, fmt).md;
  const flat = parseSongMd(md);
  return songFromFlat({ ...flat, id: generateId(), updatedAt: Date.now() });
}

// A .zip is ambiguous: our own setlist bundles carry a manifest, but an OnSong
// archive (or any folder of ChordPro someone zipped up) is a pile of songs.
// Guessing "setlist" for both is how a migrating user's first import failed, so
// look inside before deciding.
async function inspectZip(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    const hasManifest = names.some(n => /(^|\/)(setlist|manifest)\.json$/i.test(n));
    if (hasManifest) return { kind: 'setlist' };

    const songNames = names.filter(n => {
      if (/(^|\/)__MACOSX\//.test(n) || /(^|\/)\./.test(n)) return false;
      return detectFormatForFile(n) !== null || /\.txt$/i.test(n);
    });
    if (songNames.length === 0) return { kind: 'setlist' };

    const songs = [];
    const failed = [];
    for (const n of songNames) {
      try {
        songs.push(songFromText(await zip.files[n].async('string'), n));
      } catch {
        failed.push(n.split('/').pop());
      }
    }
    if (songs.length === 0) return { kind: 'setlist' };
    return { kind: 'songs', songs, failed };
  } catch {
    // Unreadable as a zip — let the setlist importer report the real error.
    return { kind: 'setlist' };
  }
}

/**
 * Classify and parse a FileList / File[].
 *
 * @returns {Promise<{ songs: object[], setlistFile: File|null, failed: string[], error: string }>}
 *   `setlistFile` set means the caller should hand it to the setlist importer.
 */
export async function parseImportFiles(fileList) {
  const files = Array.from(fileList || []);
  const empty = { songs: [], setlistFile: null, failed: [], error: '' };
  if (files.length === 0) return empty;

  const zips = files.filter(isZip);
  const pdfs = files.filter(f => !isZip(f) && isPdfFile(f));
  const plain = files.filter(f => !isZip(f) && !isPdfFile(f));

  // A zip full of songs imports alongside any loose files; a real setlist
  // bundle short-circuits, since it creates a setlist rather than songs.
  const songs = [];
  const failed = [];
  for (const z of zips) {
    const res = await inspectZip(z);
    if (res.kind === 'setlist') return { ...empty, setlistFile: z };
    songs.push(...res.songs);
    failed.push(...res.failed);
  }

  if (plain.length === 0 && pdfs.length === 0 && songs.length === 0) {
    return { ...empty, error: 'Pick .md, ChordPro, OpenSong .xml, .pdf, or .zip files.' };
  }

  // PDFs are the only import that isn't instant (pdf.js loads lazily, then each
  // page is parsed), so they're handled before the cheap text files.
  const warnings = [];
  for (const f of pdfs) {
    try {
      const { md, warnings: w } = await pdfToChart(await f.arrayBuffer());
      const flat = parseSongMd(md);
      songs.push(songFromFlat({ ...flat, id: generateId(), updatedAt: Date.now() }));
      warnings.push(...w);
    } catch (err) {
      failed.push(err?.message === 'no-text-layer'
        ? `${f.name} (scanned image — no text to read)`
        : f.name);
    }
  }

  for (const f of plain) {
    try {
      songs.push(songFromText(await readText(f), f.name));
    } catch {
      failed.push(f.name);
    }
  }

  if (songs.length === 0) {
    return {
      ...empty,
      failed,
      error: failed.length
        ? `Could not read: ${failed.join(', ')}.`
        : 'No valid song files were found.',
    };
  }
  const notes = [failed.length ? `Skipped: ${failed.join(', ')}.` : '', ...warnings].filter(Boolean);
  return { songs, setlistFile: null, failed, error: notes.join(' ') };
}
