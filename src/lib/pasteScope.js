// Where does a pasted chord sheet go?
//
// One rule, everywhere: a paste fills the section it lands in. If the pasted
// text carries its own section headers, it expands into siblings in that
// section's place. An empty new song is a single empty section, so a whole-song
// paste into it naturally becomes the whole song — not because of a "new song
// mode", but because that's what the content said.

const HEADER = /^##\s+(.+)$/;

/** Split a chart body into [{ header, lines }]. Text before the first `##`
 *  header becomes a leading block with header === null. */
export function splitSections(body) {
  const blocks = [];
  let current = { header: null, lines: [] };
  for (const line of String(body ?? '').split('\n')) {
    const m = line.match(HEADER);
    if (m) {
      if (current.header !== null || current.lines.some(l => l.trim())) blocks.push(current);
      current = { header: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  blocks.push(current);
  return blocks;
}

function blockToText({ header, lines }) {
  const body = lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
  if (header === null) return body;
  return body ? `## ${header}\n${body}` : `## ${header}`;
}

export function joinSections(blocks) {
  const text = blocks.map(blockToText).filter(b => b !== '').join('\n\n');
  return text ? `${text}\n` : '';
}

/** Does this pasted body declare its own sections? */
export function hasSectionHeaders(body) {
  return String(body ?? '').split('\n').some(l => HEADER.test(l));
}

/**
 * Merge `pastedBody` into `body` at `sectionIndex`.
 *
 * - `sectionIndex == null` → replace the whole body (a paste onto the canvas
 *   background, or onto a song with nothing in it).
 * - pasted text has headers → those sections REPLACE the target section.
 * - pasted text has no headers → it becomes the target section's content, and
 *   the section keeps its own name. Pasting a verse into "Chorus" does not
 *   rename the chorus.
 *
 * @param {string} body           current chart body (no frontmatter)
 * @param {string} pastedBody     already converted to our inline-chord format
 * @param {number|null} sectionIndex
 * @returns {string}
 */
export function applyPasteAtSection(body, pastedBody, sectionIndex) {
  const pasted = String(pastedBody ?? '').replace(/\s+$/, '');
  if (!pasted.trim()) return body;
  if (sectionIndex == null) return pasted.endsWith('\n') ? pasted : `${pasted}\n`;

  const blocks = splitSections(body);
  // Index counts real sections; a leading headerless block isn't one.
  const realIdxs = blocks.map((b, i) => (b.header !== null ? i : -1)).filter(i => i >= 0);
  const target = realIdxs[sectionIndex];
  if (target === undefined) return applyPasteAtSection(body, pasted, null);

  if (hasSectionHeaders(pasted)) {
    const incoming = splitSections(pasted).filter(b => b.header !== null || b.lines.some(l => l.trim()));
    blocks.splice(target, 1, ...incoming);
  } else {
    blocks[target] = { header: blocks[target].header, lines: pasted.split('\n') };
  }
  return joinSections(blocks);
}

/** True when the chart has no lyric/chord content at all — the state a brand
 *  new song starts in, where any paste means "this is the song". */
export function isEmptyChart(body) {
  return !splitSections(body).some(b => b.lines.some(l => l.trim()));
}
