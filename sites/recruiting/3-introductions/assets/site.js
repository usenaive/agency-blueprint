// Introductions: pairs meet as they come into view; the hero forms close in as you scroll past.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-meet]').forEach((el) => el.classList.add('is-met'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-met'); io.unobserve(e.target); }
  }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-meet]').forEach((el) => io.observe(el));

  const hero = document.querySelector('.hero');
  let queued = false;
  const update = () => {
    queued = false;
    const p = Math.min(1, Math.max(0, scrollY / hero.offsetHeight));
    hero.style.setProperty('--p', p.toFixed(3));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();
