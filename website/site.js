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
