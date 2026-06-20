/*
 * Print-preview controls for the PDF export iframe (src/pdf/exportSongPdf.js,
 * src/pdf/exportSetlistPdf.js).
 *
 * Loaded as an EXTERNAL same-origin script (`<script src="/pdf-print.js">`) so
 * the generated export document carries no inline script. That lets the app run
 * under an enforcing Content-Security-Policy with `script-src 'self'` (no
 * 'unsafe-inline'). Per-document data — the type's `defaults` and the user's
 * last-used `initialPrefs` — is passed via a NON-executed
 * `<script type="application/json" id="pdf-print-config">` block, which CSP does
 * not gate because it never runs as script.
 *
 * Generic over both export types: it reads/writes the superset of pref keys
 * (cols, size, font, chords, tabs, colors, repeats, layout). Keys absent for a
 * given document simply toggle classes that document's CSS doesn't use — a
 * harmless no-op — so one script serves song and setlist exports alike.
 */
(function () {
  var STORAGE_KEY = 'setlists-md:pdf-prefs';
  var SIZE = { S: '10pt', M: '11pt', L: '12.5pt', XL: '14pt' };
  var FONT = {
    sans:  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    serif: '"Iowan Old Style", Georgia, "Times New Roman", serif',
    mono:  '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'
  };

  function readConfig() {
    var el = document.getElementById('pdf-print-config');
    if (!el) return {};
    try { return JSON.parse(el.textContent) || {}; } catch (e) { return {}; }
  }

  var config = readConfig();
  var defaults = config.defaults || { cols: 1, size: 'M', font: 'sans', chords: true, colors: true };
  var prefs = Object.assign({}, defaults, config.initialPrefs || {});

  function readStored() {
    // Try the opener's localStorage first (parent app's origin) so prefs
    // survive across exports; fall back to our own.
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
    body.classList.toggle('no-tabs', !prefs.tabs);
    body.classList.toggle('bw', !prefs.colors);
    body.classList.toggle('collapse-repeats', !prefs.repeats);
    body.classList.toggle('cards-layout', prefs.layout === 'cards');

    // Reflect active state on the controls.
    var nodes = document.querySelectorAll('[data-control]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var k = el.getAttribute('data-control');
      var v = el.getAttribute('data-value');
      var active = false;
      if      (k === 'cols')    active = String(prefs.cols) === v;
      else if (k === 'size')    active = prefs.size === v;
      else if (k === 'font')    active = prefs.font === v;
      else if (k === 'chords')  active = !!prefs.chords;
      else if (k === 'tabs')    active = !!prefs.tabs;
      else if (k === 'colors')  active = !!prefs.colors;
      else if (k === 'repeats') active = !!prefs.repeats;
      else if (k === 'layout')  active = prefs.layout === v;
      el.classList.toggle('active', active);
    }
    writeStored(prefs);
  }

  document.addEventListener('click', function (e) {
    var ctrl = e.target.closest('[data-control]');
    if (ctrl) {
      var k = ctrl.getAttribute('data-control');
      var v = ctrl.getAttribute('data-value');
      if      (k === 'cols')    prefs.cols    = parseInt(v, 10) || 1;
      else if (k === 'size')    prefs.size    = v;
      else if (k === 'font')    prefs.font    = v;
      else if (k === 'chords')  prefs.chords  = !prefs.chords;
      else if (k === 'tabs')    prefs.tabs    = !prefs.tabs;
      else if (k === 'colors')  prefs.colors  = !prefs.colors;
      else if (k === 'repeats') prefs.repeats = !prefs.repeats;
      else if (k === 'layout')  prefs.layout  = v;
      apply();
      return;
    }
    var act = e.target.closest('[data-action]');
    if (!act) return;
    if (act.dataset.action === 'print') window.print();
    if (act.dataset.action === 'close') {
      // Inside the print-preview iframe (same-origin) remove the host overlay;
      // window.close() only applies to the legacy popup case.
      var fe = window.frameElement;
      var ov = fe && fe.ownerDocument.getElementById('pdf-print-overlay');
      if (ov) ov.remove();
      else window.close();
    }
  });

  apply();
})();
