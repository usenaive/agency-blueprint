// Affinity Wall: the notes slap onto the wall once the type is set, section squiggles draw as
// they arrive, a note lifts its corner now and then at rest, and on a desktop you can drag them.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: a still wall
  const wall = document.querySelector('.wall');
  const notes = [...wall.querySelectorAll('.note')];
  notes.forEach((n, k) => n.style.setProperty('--k', k));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => wall.classList.add('is-on'));

  const heads = document.querySelectorAll('.h2');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-on'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -15% 0px' });
    heads.forEach((h) => obs.observe(h));
  }

  // At rest: one note lifts and settles every few seconds while the wall is on screen.
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wall);
  setInterval(() => {
    if (!visible || document.hidden || wall.querySelector('.is-drag')) return;
    const n = notes[Math.floor(Math.random() * notes.length)];
    n.classList.remove('is-flutter'); void n.offsetWidth; n.classList.add('is-flutter');
  }, 2600);

  // Drag (desktop only, so a phone swipe still scrolls the page).
  const wide = matchMedia('(min-width: 901px)');
  notes.forEach((n) => {
    n.addEventListener('pointerdown', (e) => {
      if (!wide.matches || e.button !== 0) return;
      const sx = e.clientX - (parseFloat(n.style.getPropertyValue('--dx')) || 0);
      const sy = e.clientY - (parseFloat(n.style.getPropertyValue('--dy')) || 0);
      const box = wall.getBoundingClientRect(), r = n.getBoundingClientRect();
      const lim = { l: box.left - r.left, r: box.right - r.right, t: box.top - r.top, b: box.bottom - r.bottom };
      const dx0 = parseFloat(n.style.getPropertyValue('--dx')) || 0, dy0 = parseFloat(n.style.getPropertyValue('--dy')) || 0;
      n.setPointerCapture(e.pointerId); n.classList.add('is-drag'); n.classList.remove('is-flutter');
      const move = (m) => {
        const dx = Math.min(dx0 + lim.r, Math.max(dx0 + lim.l, m.clientX - sx));
        const dy = Math.min(dy0 + lim.b, Math.max(dy0 + lim.t, m.clientY - sy));
        n.style.setProperty('--dx', `${dx}px`); n.style.setProperty('--dy', `${dy}px`);
      };
      const up = () => { n.classList.remove('is-drag'); n.removeEventListener('pointermove', move); n.removeEventListener('pointerup', up); n.removeEventListener('pointercancel', up); };
      n.addEventListener('pointermove', move); n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
    });
  });
})();
