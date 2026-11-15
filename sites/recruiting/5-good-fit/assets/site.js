// Pieces snap into place as they arrive; the hero pair rests when it is off screen.
(() => {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-snap]').forEach((el) => el.classList.add('in'));
    return;
  }
  const snap = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); snap.unobserve(e.target); }
  }, { threshold: 0.3 });
  document.querySelectorAll('[data-snap]').forEach((el) => snap.observe(el));

  const hero = document.querySelector('.hero');
  if (hero) new IntersectionObserver(([e]) => hero.classList.toggle('off', !e.isIntersecting)).observe(hero);
})();
