import { useEffect, useState } from 'react';
import { loadSongs } from '../storage';

// Every word already in the user's library, for repairing split words on import.
//
// This is the cheap half of the "do we need a dictionary?" question. A real
// Romanian word list is hundreds of KB and knows nothing about worship
// vocabulary; the user's own songs are free, already local, and are made of
// exactly the words their next paste will contain. It grows with the library,
// so the tenth import repairs more than the first.
//
// Loaded once, lazily, and only when a paste is actually being reviewed.

let cache = null;

function wordsFrom(song) {
  const out = [];
  for (const arr of song?.arrangements || []) {
    for (const sec of arr?.sections || []) {
      for (const line of sec?.lines || []) {
        // section.lines[] holds strings OR tab/modulate objects.
        if (typeof line !== 'string') continue;
        // Drop inline [chords] — they'd pollute the vocabulary with "Bm7".
        const text = line.replace(/\[[^\]]*\]/g, ' ');
        const found = text.match(/\p{L}[\p{L}\p{M}'-]*/gu);
        if (found) out.push(...found);
      }
    }
  }
  return out;
}

export async function loadLibraryVocabulary() {
  if (cache) return cache;
  try {
    const songs = await loadSongs();
    const set = new Set();
    for (const song of songs || []) {
      for (const w of wordsFrom(song)) {
        // Single letters are noise and risk welding real words together.
        if (w.length > 1) set.add(w.toLowerCase());
      }
    }
    cache = set;
  } catch {
    cache = new Set(); // a missing library just means no extra vocabulary
  }
  return cache;
}

/** Clear the memo — exported for tests and after a library import. */
export function resetLibraryVocabulary() {
  cache = null;
}

export function useLibraryVocabulary() {
  const [vocab, setVocab] = useState(null);
  useEffect(() => {
    let alive = true;
    loadLibraryVocabulary().then(v => { if (alive) setVocab(v); });
    return () => { alive = false; };
  }, []);
  return vocab;
}
