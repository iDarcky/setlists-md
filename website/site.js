// Header shadow on scroll + the phone menu. Everything else on the site is static.
(function () {
  // The app lived on this address until it moved to app.setlists.md. Send on
  // what only the app understands: an icon added to a Home Screen before the
  // move (it opens here, full screen) and sign-in links whose tokens ride in
  // the #fragment, which the server-side redirects in vercel.json never see.
  var standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var authHash = /(access_token|refresh_token|error_description|type=recovery)/.test(location.hash);
  if (location.pathname === '/' && (standalone || authHash)) {
    location.replace('https://app.setlists.md/' + location.search + location.hash);
    return;
  }
  // Open every page at the top unless the link points at a section.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);
  var head = document.getElementById('head');
  if (head) addEventListener('scroll', function () { head.classList.toggle('scrolled', scrollY > 8); }, { passive: true });
  var btn = document.getElementById('menuBtn'), nav = document.getElementById('mnav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.hidden; nav.hidden = !open; btn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) { nav.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  });
})();

// "Start your church": the form posts straight into the `feedback` table, the
// same list the app's "Ask to start a church" writes to (anyone may insert,
// only the service role reads). The key is Supabase's publishable key, the
// same one the app ships; it can do nothing the table's policies don't allow.
(function () {
  var form = document.getElementById('churchForm');
  if (!form) return;
  var API = 'https://biltbdumdwugpepaawku.supabase.co/rest/v1/feedback';
  var KEY = 'sb_publishable_XkYS8KLvYNCWhNknUxZnOQ_ZUpljV6g';
  var btn = form.querySelector('button[type="submit"]');
  var err = document.getElementById('formError');
  var sent = document.getElementById('sent');
  var label = btn.textContent;
  function val(n) { return (form.elements[n].value || '').trim(); }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var bad = null;
    ['church', 'place', 'name', 'email', 'people'].forEach(function (n) {
      var el = form.elements[n];
      var ok = el.checkValidity() && val(n) !== '';
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = el;
    });
    if (bad) { bad.focus(); return; }
    if (val('website')) { form.hidden = true; sent.hidden = false; return; } // a bot filled the hidden field
    var lines = [
      '[church request] ' + val('church'),
      'Where: ' + val('place'),
      'People: ' + val('people'),
      'From: ' + val('name') + ' · ' + val('email'),
      'Came from: website (' + (form.dataset.lang || 'en') + ')',
      val('note') ? 'Note: ' + val('note') : null,
    ].filter(Boolean);
    btn.disabled = true; btn.textContent = form.dataset.sending || '…';
    fetch(API, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ type: 'general', description: lines.join('\n'), user_agent: navigator.userAgent }),
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      sent.querySelector('[data-ok-email]').textContent = val('email');
      form.hidden = true; sent.hidden = false; sent.focus();
    }).catch(function () {
      err.hidden = false;
    }).then(function () {
      btn.disabled = false; btn.textContent = label;
    });
  });
  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.checkValidity() && e.target.value.trim()) e.target.setAttribute('aria-invalid', 'false');
  });
})();
