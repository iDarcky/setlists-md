// Shared HTML document shell for the PDF export popup.
//
// Both exportSongPdf and exportSetlistPdf hand `buildPdfDocument` a title and
// a body (cover HTML + content HTML). This module owns the CSS, the controls
// toolbar, the brand footer, and the in-popup script that drives the live
// layout controls (cols / size / font / chords / colors, plus an optional
// mode toggle for setlist exports).

const PREFS_KEY = 'setlists-md:pdf-prefs';

// Read the user's last-used PDF prefs from the parent app's localStorage so
// the popup boots with their preferred layout.
export function readInitialPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isStandaloneMode() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

// In standalone PWA mode (iOS home-screen app), window.open is blocked.
// We inject a full-screen overlay with an iframe instead — same-origin srcdoc
// so localStorage prefs work, and interactive controls inside the iframe still
// function normally before the user prints.
function openPrintOverlay(html) {
  document.getElementById('pdf-print-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pdf-print-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:999999;background:#fff;display:flex;flex-direction:column;' +
    'font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;';

  const safeTop = 'env(safe-area-inset-top, 0px)';
  const header = document.createElement('div');
  header.style.cssText =
    `display:flex;align-items:center;justify-content:space-between;` +
    `padding-top:${safeTop};padding-left:16px;padding-right:16px;padding-bottom:0;` +
    `background:#fff;border-bottom:1px solid #e5e7eb;flex-shrink:0;min-height:52px;`;

  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'Done';
  doneBtn.style.cssText =
    'background:none;border:none;cursor:pointer;font-size:15px;font-weight:600;' +
    'color:#6366f1;padding:8px 4px;';
  doneBtn.onclick = () => overlay.remove();

  const titleEl = document.createElement('span');
  titleEl.textContent = 'Print Preview';
  titleEl.style.cssText = 'font-weight:600;font-size:16px;color:#111;';

  const printBtn = document.createElement('button');
  printBtn.textContent = 'Print…';
  printBtn.style.cssText =
    'background:#6366f1;border:none;cursor:pointer;font-size:15px;font-weight:600;' +
    'color:#fff;padding:8px 14px;border-radius:8px;';
  printBtn.onclick = () => {
    const frame = document.getElementById('pdf-print-frame');
    frame?.contentWindow?.print();
  };

  header.appendChild(doneBtn);
  header.appendChild(titleEl);
  header.appendChild(printBtn);

  const hint = document.createElement('p');
  hint.textContent =
    'Adjust layout options below, then tap Print… — or use the Share ↑ button for more options.';
  hint.style.cssText =
    'margin:0;padding:6px 16px;font-size:12px;color:#6b7280;' +
    'background:#f9fafb;border-bottom:1px solid #e5e7eb;flex-shrink:0;';

  const frame = document.createElement('iframe');
  frame.id = 'pdf-print-frame';
  frame.style.cssText = 'flex:1;border:none;width:100%;background:#fff;';
  frame.srcdoc = html;

  overlay.appendChild(header);
  overlay.appendChild(hint);
  overlay.appendChild(frame);
  document.body.appendChild(overlay);
}

// Open the print preview. On desktop/regular browser this uses a popup window;
// on iOS standalone PWA it falls back to an in-app full-screen overlay so the
// user isn't hit with a broken "allow popups" error.
export function openPrintWindow(html) {
  if (isStandaloneMode()) {
    openPrintOverlay(html);
    return null;
  }
  // Desktop / regular browser: popup so the interactive toolbar doesn't
  // occlude the current page. Do NOT pass noopener/noreferrer — that causes
  // window.open to return null and prevents document.write.
  const w = window.open('about:blank', '_blank', 'width=900,height=1100,resizable=yes,scrollbars=yes');
  if (!w || w.closed || typeof w.document === 'undefined') {
    alert('Could not open the print window. Please allow popups for this site and try again.');
    return null;
  }
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    return w;
  } catch (err) {
    console.error('[openPrintWindow] failed to populate popup', err);
    try { w.close(); } catch { /* ignore */ }
    alert('Could not render the printable view. Please try again.');
    return null;
  }
}

// CSS shared by every PDF export. Lives as a single string so the popup is
// self-contained (it doesn't have access to the parent app's stylesheet).
const BASE_STYLES = `
  @page {
    size: Letter;
    margin: 0.55in 0.55in 0.7in;
    @bottom-right {
      content: counter(page) " / " counter(pages);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 9pt;
      color: #888;
    }
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  :root {
    --body-size: 11pt;
    --lyric-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --col-count: 1;
    --col-gap: 0.4in;
  }

  body {
    font-family: var(--lyric-font);
    font-size: var(--body-size);
    line-height: 1.45;
  }

  /* Multi-column body layout (cover header stays full width). */
  main {
    column-count: var(--col-count);
    column-gap: var(--col-gap);
    column-fill: balance;
  }

  /* "no-chords" mode: hide the chord row entirely; lyrics flow as plain text. */
  body.no-chords .chord { display: none !important; }
  body.no-chords .cl-line { line-height: 1.4; }
  body.no-chords .cl-pair { margin-right: 0; }

  /* "bw" (no-color) mode: drop section / chord / structure colors. */
  body.bw .section-label,
  body.bw .structure-pill { color: #222 !important; }
  body.bw .section-rule   { background: #ccc !important; }
  body.bw .structure-pill { border-color: #ccc !important; background: #f5f5f5 !important; }
  body.bw .cl-pair .chord { color: #222 !important; }
  body.bw .modulate-pill  { background: #444 !important; }
  body.bw .break-divider .break-rule { background: #ccc !important; }

  /* On-screen wrapper. */
  .page {
    max-width: 7.5in;
    margin: 0 auto;
    padding: 24px;
  }
  @media print {
    .page { max-width: none; margin: 0; padding: 0; }
    .toolbar { display: none !important; }
  }

  /* Floating toolbar shown on screen only, before/after print. */
  .toolbar {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 0 14px;
    background: linear-gradient(#fff, #fff 80%, rgba(255,255,255,0));
    z-index: 10;
  }
  .toolbar-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    align-items: center;
  }
  .action-group {
    display: inline-flex;
    gap: 8px;
    margin-left: auto;
  }
  .control-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .control-group .group-label {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    margin-right: 2px;
  }
  .seg {
    display: inline-flex;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    padding: 2px;
    background: #fafafa;
  }
  .seg button {
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 9.5pt;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #555;
  }
  .seg button.active {
    background: #fff;
    color: #111;
    box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    font-weight: 600;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    background: #fafafa;
    font-size: 9.5pt;
    cursor: pointer;
    color: #555;
  }
  .toggle.active {
    background: #fff;
    color: #111;
    border-color: #b8b8b8;
    font-weight: 600;
  }
  .toggle .check {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid #c0c0c0;
    background: #fff;
    position: relative;
  }
  .toggle.active .check { background: #111; border-color: #111; }
  .toggle.active .check::after {
    content: "";
    position: absolute;
    left: 3px; top: 0px;
    width: 4px; height: 8px;
    border: solid #fff;
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg);
  }

  .toolbar .tip {
    flex: 1;
    font-size: 9pt;
    color: #777;
    line-height: 1.35;
  }
  .toolbar .tip strong { color: #444; font-weight: 600; }
  .toolbar button.action {
    font: inherit;
    font-size: 10pt;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid #d0d0d0;
    background: #fff;
    cursor: pointer;
    white-space: nowrap;
  }
  .toolbar button.action.primary {
    background: #111;
    color: #fff;
    border-color: #111;
  }

  /* ── Cover header ───────────────────────────────────────────────── */
  .cover {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .cover h1 {
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
    font-size: 26pt;
    line-height: 1.1;
    margin: 0 0 4px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .cover .subtitle {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 8px;
    font-size: 10pt;
    color: #666;
    margin-bottom: 10px;
  }
  .sub-artist { color: #444; font-weight: 500; }
  .sub-sep    { color: #bbb; }
  .sub-meta   { color: #555; }
  .sub-meta strong { color: #111; font-weight: 600; }
  .sub-label  {
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
    font-weight: 700;
    margin-right: 1px;
  }
  .sub-unit   { color: #888; font-size: 9pt; }
  .meta-shift { color: #888; font-weight: 400; font-size: 9pt; }
  .cover-artist {
    margin-top: 6px;
    font-size: 10pt;
    color: #666;
    font-weight: 500;
  }
  .cover-structure {
    margin-top: 6px;
    font-size: 9.5pt;
    color: #555;
    line-height: 1.5;
  }

  .structure-ribbon {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }
  .structure-pill {
    font-size: 8.5pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 9px;
    border-radius: 999px;
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .cover-tags {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
  }
  .cover-tags .tag {
    font-size: 8.5pt;
    color: #555;
    padding: 2px 7px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
  }
  .cover-aux {
    margin-top: 10px;
    font-size: 9pt;
    color: #666;
  }
  .cover-aux strong { color: #444; margin-right: 4px; font-weight: 600; }
  .cover-notes {
    margin-top: 10px;
    font-size: 9.5pt;
    color: #444;
    font-style: italic;
  }
  .cover-notes strong { font-style: normal; color: #222; margin-right: 4px; }

  /* ── Sections ───────────────────────────────────────────────────── */
  .song-section {
    margin: 0 0 18px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .section-label {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--accent);
  }
  .section-rule {
    flex: 1;
    height: 1px;
    background: color-mix(in srgb, var(--accent) 30%, #e0e0e0);
  }
  .section-note {
    font-size: 9.5pt;
    font-style: italic;
    color: #555;
    border-left: 2px solid #ccc;
    padding: 1px 0 1px 8px;
    margin: 0 0 6px 2px;
  }
  .section-body { padding-left: 2px; }

  /* ── Lyric / chord lines ────────────────────────────────────────── */
  .plain-line { margin: 0 0 4px; white-space: pre-wrap; }
  .empty-line { height: 0.6em; }
  .cl-line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    margin: 0 0 6px;
    line-height: 1;
  }
  .cl-line.chord-only-line { margin-bottom: 4px; }
  .cl-pair {
    display: inline-flex;
    flex-direction: column;
    justify-content: flex-end;
    margin-right: 0;
  }
  .cl-pair .chord {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    font-weight: 700;
    font-size: 0.92em;
    color: #B07A1F;
    line-height: 1;
    padding: 0 0.5em 2px 0;
    white-space: nowrap;
  }
  .cl-pair .lyric { line-height: 1.25; white-space: pre-wrap; }
  .cl-pair.chord-only { margin-right: 0.5em; }
  .cl-pair.chord-only .chord { padding-bottom: 0; }
  .inline-note {
    color: #777;
    font-style: italic;
    font-size: 0.82em;
    margin-left: 0.5em;
  }
  .inline-note-cl { align-self: flex-end; }

  /* ── Tab blocks ─────────────────────────────────────────────────── */
  .tab-block {
    font-family: "JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    font-size: 9.5pt;
    line-height: 1.35;
    white-space: pre;
    overflow: visible;
    background: #f7f7f5;
    border: 1px solid #ececea;
    border-radius: 4px;
    padding: 8px 10px;
    margin: 6px 0 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .tab-time {
    display: block;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 8.5pt;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
  }

  /* ── Modulate marker ────────────────────────────────────────────── */
  .modulate { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
  .modulate-rule { flex: 1; height: 1px; background: #d0d0d0; }
  .modulate-pill {
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    padding: 3px 10px;
    border-radius: 999px;
    background: #111;
    color: #fff;
  }

  /* ── Brand footer (repeats on every printed page) ───────────────── */
  .brand-footer { display: none; }
  @media print {
    .brand-footer {
      display: block;
      position: fixed;
      bottom: 0.25in;
      left: 0;
      right: 0;
      text-align: center;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-size: 8.5pt;
      letter-spacing: 0.04em;
      color: #888;
    }
    .brand-footer .brand-name { color: #444; font-weight: 500; }
    .brand-footer .brand-md   { color: #53796F; font-weight: 700; }
  }

  /* ── Setlist-specific: cover order list, break dividers, song breaks ── */
  .setlist-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    font-size: 10pt;
    color: #555;
    margin-bottom: 10px;
  }
  .setlist-meta strong { color: #111; font-weight: 600; }
  .setlist-meta .sep { color: #bbb; }

  .order-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .order-list .order-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid #eee;
  }
  .order-list .order-row:last-child { border-bottom: 0; }
  .order-num {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 10pt;
    font-weight: 700;
    color: #444;
    min-width: 2.2em;
    text-align: right;
  }
  .order-title { flex: 1; min-width: 0; font-weight: 500; color: #111; }
  .order-artist { color: #888; font-weight: 400; margin-left: 8px; font-size: 9.5pt; }
  .order-key {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-weight: 700;
    color: #B07A1F;
    min-width: 2.5em;
    text-align: right;
  }
  .order-tempo {
    font-size: 9pt;
    color: #888;
    min-width: 4em;
    text-align: right;
  }
  .order-break {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    color: #777;
    font-style: italic;
    font-size: 9.5pt;
  }
  .order-break .break-rule { flex: 1; height: 1px; background: #ddd; }
  .order-break .break-label { white-space: nowrap; }
  .order-break .break-dur { color: #aaa; font-size: 9pt; }

  /* In-flow break divider used between songs in Full mode. */
  .break-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 18px 0;
    page-break-after: avoid;
    break-after: avoid;
  }
  .break-divider .break-rule { flex: 1; height: 1px; background: #ddd; }
  .break-divider .break-label {
    font-size: 9.5pt;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: #777;
    font-weight: 600;
  }
  .break-divider .break-dur { color: #aaa; font-size: 9pt; }

  .song-chart { break-before: page; page-break-before: always; }
  .song-chart:first-of-type { break-before: auto; page-break-before: auto; }

  /* ── Mode visibility: setlist export only ───────────────────────── */
  body.mode-order .full-only { display: none !important; }
  body.mode-full  .order-only { display: none !important; }
`;

// JS that runs inside the popup. Wires up live controls, persists prefs,
// and reflects active state. Generic enough to support an optional Mode
// segmented control (used only by the setlist export).
function buildPopupScript(initialPrefs) {
  // Embed initial prefs as a JS literal. Escape `</script>` defensively
  // (it can't appear in a JSON-stringified prefs object, but be safe).
  const inlinePrefs = JSON.stringify(initialPrefs).replace(/</g, '\\u003c');
  return `
  (function () {
    var STORAGE_KEY = 'setlists-md:pdf-prefs';
    var DEFAULTS = { cols: 1, size: 'M', font: 'sans', chords: true, colors: true, mode: 'full' };
    var SIZE = { S: '10pt', M: '11pt', L: '12.5pt', XL: '14pt' };
    var FONT = {
      sans:  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      serif: '"Iowan Old Style", Georgia, "Times New Roman", serif',
      mono:  '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'
    };

    var initial = ${inlinePrefs};
    var prefs = Object.assign({}, DEFAULTS, initial);

    function readStored() {
      try {
        if (window.opener && window.opener.localStorage) {
          var raw = window.opener.localStorage.getItem(STORAGE_KEY);
          if (raw) return JSON.parse(raw);
        }
      } catch (e) { /* cross-origin or closed opener */ }
      try {
        var raw2 = localStorage.getItem(STORAGE_KEY);
        if (raw2) return JSON.parse(raw2);
      } catch (e) { /* unavailable */ }
      return null;
    }

    function writeStored(p) {
      var s = JSON.stringify(p);
      try { if (window.opener && window.opener.localStorage) window.opener.localStorage.setItem(STORAGE_KEY, s); } catch (e) {}
      try { localStorage.setItem(STORAGE_KEY, s); } catch (e) {}
    }

    var stored = readStored();
    if (stored) prefs = Object.assign(prefs, stored);

    var root = document.documentElement;
    var body = document.body;

    function apply() {
      root.style.setProperty('--col-count', String(prefs.cols));
      root.style.setProperty('--body-size', SIZE[prefs.size] || SIZE.M);
      root.style.setProperty('--lyric-font', FONT[prefs.font] || FONT.sans);
      body.classList.toggle('no-chords', !prefs.chords);
      body.classList.toggle('bw', !prefs.colors);

      // Mode is only meaningful when the document opted in (setlist export).
      // Toggle a body class so CSS can hide order-only / full-only blocks.
      var classes = body.className.split(/\\s+/).filter(function (c) { return !/^mode-/.test(c); });
      if (document.querySelector('[data-control="mode"]')) {
        classes.push('mode-' + (prefs.mode || 'full'));
      }
      body.className = classes.join(' ').trim();

      var nodes = document.querySelectorAll('[data-control]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var k = el.getAttribute('data-control');
        var v = el.getAttribute('data-value');
        var active = false;
        if      (k === 'cols')   active = String(prefs.cols) === v;
        else if (k === 'size')   active = prefs.size === v;
        else if (k === 'font')   active = prefs.font === v;
        else if (k === 'mode')   active = prefs.mode === v;
        else if (k === 'chords') active = !!prefs.chords;
        else if (k === 'colors') active = !!prefs.colors;
        el.classList.toggle('active', active);
      }
      writeStored(prefs);
    }

    document.addEventListener('click', function (e) {
      var ctrl = e.target.closest('[data-control]');
      if (ctrl) {
        var k = ctrl.getAttribute('data-control');
        var v = ctrl.getAttribute('data-value');
        if      (k === 'cols')   prefs.cols   = parseInt(v, 10) || 1;
        else if (k === 'size')   prefs.size   = v;
        else if (k === 'font')   prefs.font   = v;
        else if (k === 'mode')   prefs.mode   = v;
        else if (k === 'chords') prefs.chords = !prefs.chords;
        else if (k === 'colors') prefs.colors = !prefs.colors;
        apply();
        return;
      }
      var act = e.target.closest('[data-action]');
      if (!act) return;
      if (act.dataset.action === 'print') window.print();
      if (act.dataset.action === 'close') window.close();
    });

    apply();
  })();`;
}

// Build the controls toolbar. `modes` is optional; pass an array like
// [{ value: 'order', label: 'Order' }, { value: 'full', label: 'Full' }] to
// add a Mode segmented control (only meaningful for setlist exports).
function buildToolbar({ modes } = {}) {
  const modeControl = modes && modes.length
    ? `
        <div class="control-group">
          <span class="group-label">Mode</span>
          <div class="seg" role="group" aria-label="Mode">
            ${modes.map(m => `<button type="button" data-control="mode" data-value="${m.value}">${m.label}</button>`).join('')}
          </div>
        </div>`
    : '';

  return `
    <div class="toolbar" data-toolbar>
      <div class="toolbar-row tip-row">
        <div class="tip">
          <strong>Tip:</strong> in the print dialog, open <em>More settings</em> and uncheck
          <em>Headers and footers</em> for a clean output (no URL or date at the top).
        </div>
      </div>
      <div class="toolbar-row controls">
        ${modeControl}
        <div class="control-group">
          <span class="group-label">Cols</span>
          <div class="seg" role="group" aria-label="Columns">
            <button type="button" data-control="cols" data-value="1">1</button>
            <button type="button" data-control="cols" data-value="2">2</button>
          </div>
        </div>
        <div class="control-group">
          <span class="group-label">Size</span>
          <div class="seg" role="group" aria-label="Font size">
            <button type="button" data-control="size" data-value="S">S</button>
            <button type="button" data-control="size" data-value="M">M</button>
            <button type="button" data-control="size" data-value="L">L</button>
            <button type="button" data-control="size" data-value="XL">XL</button>
          </div>
        </div>
        <div class="control-group">
          <span class="group-label">Font</span>
          <div class="seg" role="group" aria-label="Font family">
            <button type="button" data-control="font" data-value="sans">Sans</button>
            <button type="button" data-control="font" data-value="serif">Serif</button>
            <button type="button" data-control="font" data-value="mono">Mono</button>
          </div>
        </div>
        <button type="button" class="toggle" data-control="chords">
          <span class="check"></span>Chords
        </button>
        <button type="button" class="toggle" data-control="colors">
          <span class="check"></span>Colors
        </button>
        <div class="action-group">
          <button class="action primary" type="button" data-action="print">Print / Save as PDF</button>
          <button class="action" type="button" data-action="close">Close</button>
        </div>
      </div>
    </div>`;
}

// Wrap a body of HTML in the full document shell.
//
//   title         — used as <title> (drives Chrome's Save-as-PDF filename
//                   suggestion and the browser's auto-header).
//   bodyHtml      — markup to slot into the page (cover + content).
//   initialPrefs  — last-used PDF prefs from the parent app's localStorage.
//   modes         — optional array enabling the Mode segmented control.
//   extraStyles   — optional extra CSS appended to BASE_STYLES.
export function buildPdfDocument({ title, bodyHtml, initialPrefs = {}, modes, extraStyles = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>${BASE_STYLES}${extraStyles}</style>
</head>
<body>
  <div class="page">
    ${buildToolbar({ modes })}

    <footer class="brand-footer" aria-hidden="true">
      <span class="brand-name">setlists</span><span class="brand-md">.md</span>
    </footer>

    ${bodyHtml}
  </div>

  <script>${buildPopupScript(initialPrefs)}</script>
</body>
</html>`;
}
