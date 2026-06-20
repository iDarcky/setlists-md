import { describe, it, expect } from 'vitest';
import { buildPrintControls } from '../pdf/pdfDocument';

describe('buildPrintControls (CSP-safe print controls)', () => {
  it('emits an external script + a JSON config block, never an inline script', () => {
    const out = buildPrintControls({ defaults: { cols: 1 }, initialPrefs: { size: 'L' } });
    expect(out).toContain('<script src="/pdf-print.js"></script>');
    expect(out).toContain('<script type="application/json" id="pdf-print-config">');
    // No executable inline script: every <script ...> opening tag must carry a
    // src or a non-executable type. A bare `<script>` (inline JS) would be
    // blocked under enforcing `script-src 'self'`.
    const openings = out.match(/<script[^>]*>/g) || [];
    for (const tag of openings) {
      const ok = tag.includes('src=') || tag.includes('type="application/json"');
      expect(ok, `inline script tag found: ${tag}`).toBe(true);
    }
  });

  it('round-trips the config payload through the JSON block', () => {
    const out = buildPrintControls({
      defaults: { cols: 2, size: 'M', chords: true },
      initialPrefs: { size: 'XL', layout: 'cards' },
    });
    const json = out.match(/id="pdf-print-config">([\s\S]*?)<\/script>/)[1];
    expect(JSON.parse(json)).toEqual({
      defaults: { cols: 2, size: 'M', chords: true },
      initialPrefs: { size: 'XL', layout: 'cards' },
    });
  });

  it('escapes < so a stray </script> in a pref value cannot break out', () => {
    const out = buildPrintControls({ initialPrefs: { note: '</script><img>' } });
    // The raw closing-tag sequence must not appear inside the data block.
    const block = out.slice(out.indexOf('pdf-print-config'), out.indexOf('/pdf-print.js'));
    expect(block).not.toContain('</script><img>');
    // …but it still parses back to the original value.
    const json = out.match(/id="pdf-print-config">([\s\S]*?)<\/script>/)[1];
    expect(JSON.parse(json).initialPrefs.note).toBe('</script><img>');
  });

  it('defaults to empty payloads when called with no args', () => {
    const out = buildPrintControls();
    const json = out.match(/id="pdf-print-config">([\s\S]*?)<\/script>/)[1];
    expect(JSON.parse(json)).toEqual({ defaults: {}, initialPrefs: {} });
  });
});
