// Header shadow on scroll + the phone menu. Everything else on the site is static.
(function () {
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
