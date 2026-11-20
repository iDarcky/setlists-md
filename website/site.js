// Header shadow on scroll + the phone menu. Everything else on the site is static.
(function () {
  // Shown inside the app (help, privacy, terms, copyright with ?app=1): the
  // app draws its own header, so drop the site's menu and footer, and send
  // every link out to the browser instead of navigating inside the app's frame.
  if (/[?&]app=1(&|$)/.test(location.search)) {
    document.documentElement.classList.add('in-app');
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.getAttribute('href').charAt(0) === '#') return;
      a.target = '_blank'; a.rel = 'noopener';
    });
  }
  // Open every page at the top unless the link points at a section.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // scrollIntoView as well: inside an embedding frame (a preview) it also
  // scrolls the page around the frame, which scrollTo cannot reach.
  if (!location.hash) { scrollTo(0, 0); var top = document.body.firstElementChild; if (top && top.scrollIntoView) top.scrollIntoView({ block: 'start' }); }
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

// Fade sections in as they scroll into view.
(function () {
  if (!('IntersectionObserver' in window)) return;
  var els = document.querySelectorAll('.say, .cols, .things, .faq, .closer h2');
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
})();
