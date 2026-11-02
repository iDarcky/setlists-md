// The tab grid's model: a cell per string per slot, to and from ASCII tab.
// Shared by the old tab editor and the new one (features/song-edit/TabTool).

export const TECHNIQUES = [
  { id: 'h', title: 'Hammer-on' }, { id: 'p', title: 'Pull-off' }, { id: 's', title: 'Slide' },
  { id: 'b', title: 'Bend' }, { id: '~', title: 'Vibrato' }, { id: 'x', title: 'Mute' },
];
export const DURATIONS = [
  { id: 'h', label: '𝅗𝅥', beats: 2, title: 'Half' },
  { id: 'q', label: '♩', beats: 1, title: 'Quarter' },
  { id: 'dq', label: '♩.', beats: 1.5, title: 'Dotted quarter' },
  { id: 'e', label: '♪', beats: 0.5, title: 'Eighth' },
  { id: 's', label: '𝅘𝅥𝅯', beats: 0.25, title: 'Sixteenth' },
];

export const slotsPerMeasure = (timeSig, cpb) => (parseInt((timeSig || '4/4').split('/')[0], 10) || 4) * cpb;

export function beatLabels(timeSig, cpb) {
  const num = parseInt((timeSig || '4/4').split('/')[0], 10) || 4;
  const sub = cpb === 4 ? ['', 'e', '&', 'a'] : cpb === 2 ? ['', '&'] : [''];
  const labels = [];
  for (let b = 1; b <= num; b++) for (let s = 0; s < cpb; s++) labels.push(s === 0 ? String(b) : (sub[s] || ''));
  return labels;
}

export const makeGrid = (measures, timeSig, strings, cpb) =>
  strings.map(() => Array(slotsPerMeasure(timeSig, cpb) * measures).fill(null));

export function gridToAscii(grid, measures, timeSig, strings, cpb) {
  const spm = slotsPerMeasure(timeSig, cpb);
  return strings.map((name, si) => {
    let line = name + '|';
    for (let m = 0; m < measures; m++) {
      for (let pos = 0; pos < spm; pos++) {
        const cell = grid[si][m * spm + pos];
        if (cell !== null) {
          const fret = typeof cell === 'object' ? cell.fret : cell;
          const tech = typeof cell === 'object' ? (cell.technique || '') : '';
          line += String(fret) + tech;
          line += '-'.repeat(Math.max(0, 2 - (String(fret).length + (tech ? 1 : 0))));
        } else line += '---';
      }
      if (m < measures - 1) line += '|';
    }
    return line;
  }).join('\n');
}

export function gridFromTab(initialTab, timeSig, strings) {
  const cpb = 4;
  const measures = Math.max(2, initialTab.strings[0]?.content?.split('|').length || 2);
  const spm = slotsPerMeasure(timeSig, cpb);
  const grid = makeGrid(measures, timeSig, strings, cpb);
  initialTab.strings.forEach((str, si) => {
    if (si >= strings.length) return;
    const content = str.content; let slot = 0; let i = 0;
    while (i < content.length && slot < spm * measures) {
      const ch = content[i];
      if (ch === '|') { i++; continue; }
      if (ch >= '0' && ch <= '9') {
        let f = ch;
        if (i + 1 < content.length && content[i + 1] >= '0' && content[i + 1] <= '9') { f += content[i + 1]; i++; }
        let tech = null;
        if (i + 1 < content.length && 'hpsbx~'.includes(content[i + 1])) { tech = content[i + 1]; i++; }
        grid[si][slot] = tech ? { fret: parseInt(f, 10), technique: tech } : parseInt(f, 10);
        slot++;
      } else if (ch === '-') slot++;
      i++;
    }
  });
  return { grid, measures };
}
