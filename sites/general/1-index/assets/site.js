// Index: pointing at an entry turns the side card to the page it locates, and the thumb tab of
// the section being read stands out of the page edge. Without JS the card shows its how-to
// note and every entry is still a plain link.
(() => {
  const card = document.querySelector('.peek__card');
  const set = (k, v) => { card.querySelector(`[data-peek="${k}"]`).textContent = v; };
  const text = (el) => (el ? el.textContent.trim() : '');
  let current = null;
  const show = (a) => {
    if (!card || a === current) return;
    current = a;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    const h = target.querySelector('h3');
    set('loc', `${a.dataset.loc.includes('.') ? '' : '§'}${a.dataset.loc}`);
    set('t', h ? text(h) : text(a.querySelector('.e')));
    set('d', h ? text(h.nextElementSibling) : target.id === 'disciplines' ? 'One of the six disciplines listed in section 2.' : text(target.querySelector('.write__lede')));
    if (document.documentElement.classList.contains('motion')) {
      card.classList.remove('turn'); void card.offsetWidth; card.classList.add('turn');
    }
  };
  document.querySelectorAll('.entry a').forEach((a) => {
    a.addEventListener('pointerenter', () => show(a));
    a.addEventListener('focus', () => show(a));
  });

  const tabs = document.querySelectorAll('[data-tab]');
  if (!tabs.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.tab === e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section[id]').forEach((s) => io.observe(s));
})();
