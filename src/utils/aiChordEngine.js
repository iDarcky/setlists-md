import Meyda from 'meyda';

/**
 * AI Chord Detection Engine
 *
 * Uses Meyda for Chromagram extraction and template matching for chord recognition.
 */

const CHROMA_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Major and Minor templates (12-bit vectors)
const TEMPLATES = [];
for (let i = 0; i < 12; i++) {
  // Major: root, +4 semitones, +7 semitones
  const maj = new Array(12).fill(0);
  maj[i] = 1;
  maj[(i + 4) % 12] = 1;
  maj[(i + 7) % 12] = 1;
  TEMPLATES.push({ name: CHROMA_NAMES[i], vector: maj });

  // Minor: root, +3 semitones, +7 semitones
  const min = new Array(12).fill(0);
  min[i] = 1;
  min[(i + 3) % 12] = 1;
  min[(i + 7) % 12] = 1;
  TEMPLATES.push({ name: CHROMA_NAMES[i] + 'm', vector: min });
}

/**
 * Calculates the cosine similarity between two vectors.
 */
function similarity(v1, v2) {
  let dot = 0, mag1 = 0, mag2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    mag1 += v1[i] * v1[i];
    mag2 += v2[i] * v2[i];
  }
  return mag1 && mag2 ? dot / (Math.sqrt(mag1) * Math.sqrt(mag2)) : 0;
}

export async function detectChords(audioFile, onProgress) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await audioFile.arrayBuffer();
  onProgress(10);

  const audioBuffer = await context.decodeAudioData(arrayBuffer);
  onProgress(30);

  const data = audioBuffer.getChannelData(0); // Use mono

  // Analysis parameters
  const bufferSize = 4096;
  const hopSize = 2048;
  const windowCount = Math.floor((data.length - bufferSize) / hopSize);

  const results = [];

  // Process the audio in chunks
  for (let i = 0; i < windowCount; i++) {
    const start = i * hopSize;
    const signal = data.slice(start, start + bufferSize);

    // Meyda extraction
    const features = Meyda.extract('chroma', signal);

    if (features) {
      let bestMatch = { name: 'N.C.', score: -1 };
      for (const t of TEMPLATES) {
        const s = similarity(features, t.vector);
        if (s > bestMatch.score) {
          bestMatch = { name: t.name, score: s };
        }
      }

      results.push({
        time: (start / audioBuffer.sampleRate).toFixed(2),
        chord: bestMatch.name
      });
    }

    if (i % 50 === 0) {
      onProgress(30 + Math.floor((i / windowCount) * 60));
      // Yield to main thread to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  onProgress(95);

  // Post-processing: Smooth chords and remove "N.C." flickering
  const smoothed = [];
  const minDuration = 0.5; // seconds
  let current = null;

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (!current || current.chord !== res.chord) {
      if (current) {
        smoothed.push(current);
      }
      current = { ...res };
    }
  }
  if (current) smoothed.push(current);

  // Filter out very short segments (noise)
  const finalChords = [];
  for (let i = 0; i < smoothed.length; i++) {
    const nextTime = smoothed[i+1] ? parseFloat(smoothed[i+1].time) : audioBuffer.duration;
    const duration = nextTime - parseFloat(smoothed[i].time);
    if (duration > minDuration) {
      finalChords.push(smoothed[i]);
    }
  }

  // Convert to Markdown structure
  const sections = [
    {
      type: 'Chorus',
      lines: []
    }
  ];

  // Group into lines for readability (4-8 chords per line)
  let currentLine = '';
  for (let i = 0; i < finalChords.length; i++) {
    currentLine += `[${finalChords[i].chord}]   `;
    if ((i + 1) % 6 === 0) {
      sections[0].lines.push(currentLine.trim());
      currentLine = '';
    }
  }
  if (currentLine) sections[0].lines.push(currentLine.trim());

  return {
    title: audioFile.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
    artist: 'AI Analysis',
    key: finalChords[0]?.chord.replace('m', '') || 'C',
    tempo: 120, // Tempo detection would be a separate pass
    sections
  };
}
