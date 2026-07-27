import { it, expect } from 'vitest';
import { inferSections } from '../lib/detectSections';
import { importChartText } from '../lib/importChords';
import { parseSongMd, parseFrontmatterFields, serializeFrontmatterFields, splitMd } from '../parser';

it('repeat mark → play order, end to end', () => {
  const pasted = 'Cât de departe eram de Tine\nUn munte ce nu-l puteam urca\n\n//: Aleluia! Isus m-a eliberat! ://';

  // 1. Review reads it.
  const blocks = inferSections(pasted);
  expect(blocks[1].repeat).toBe(2);
  expect(blocks[1].lines).toEqual(['Aleluia! Isus m-a eliberat!']);

  // 2. Review builds the labelled body + the order.
  const labels = ['Verse 1', 'Verse 2'];
  const body = blocks.map((b, i) => `## ${labels[i]}\n${b.lines.join('\n')}`).join('\n\n');
  const structure = blocks.flatMap((b, i) => Array.from({ length: b.repeat }, () => labels[i]));
  expect(structure).toEqual(['Verse 1', 'Verse 2', 'Verse 2']);

  // 3. Editor writes it into the frontmatter.
  const converted = importChartText(body).body;
  const fm = serializeFrontmatterFields({
    ...parseFrontmatterFields(''),
    title: 'T', key: 'C',
    structure: structure.join(', '),
    structuremode: 'custom',
  });
  const md = `---\n${fm}\n---\n\n${converted}`;

  // 4. The song carries the repeat, and the lyrics are clean.
  const song = parseSongMd(md);
  expect(song.structure).toEqual(['Verse 1', 'Verse 2', 'Verse 2']);
  expect(song.structureMode).toBe('custom');
  const all = song.sections.flatMap(s => s.lines).join('\n');
  expect(all).toContain('Aleluia! Isus m-a eliberat!');
  expect(all).not.toContain('//:');
  expect(all).not.toContain('://');
  expect(splitMd(md).body).not.toContain('://');
});
