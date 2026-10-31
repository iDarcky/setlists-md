// A small markdown reader for notes: # and ## headings, **bold**, *italic*,
// "- " lists and paragraphs. Builds React elements, never HTML strings, so a
// note can't inject anything.

function inline(text, key) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith('**')
      ? <strong key={`${key}-${i++}`} className="font-semibold">{t.slice(2, -2)}</strong>
      : <em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text = '', className }) {
  const blocks = [];
  let list = null;
  String(text).split('\n').forEach((raw, n) => {
    const line = raw.trimEnd();
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      if (!list) { list = []; blocks.push({ list }); }
      list.push(li[1]);
      return;
    }
    list = null;
    if (!line.trim()) return;
    const h = line.match(/^(#{1,2})\s+(.*)$/);
    blocks.push(h ? { h: h[1].length, text: h[2], n } : { p: line, n });
  });
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.list) return <ul key={i} className="my-1.5 list-disc pl-5">{b.list.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</ul>;
        if (b.h === 1) return <h2 key={i} className="m-0 mb-1 mt-3 text-[22px] font-semibold leading-7 first:mt-0">{inline(b.text, i)}</h2>;
        if (b.h === 2) return <h3 key={i} className="m-0 mb-1 mt-3 text-[18px] font-semibold leading-6 first:mt-0">{inline(b.text, i)}</h3>;
        return <p key={i} className="m-0 my-1.5">{inline(b.p, i)}</p>;
      })}
    </div>
  );
}
