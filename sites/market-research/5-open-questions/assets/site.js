// Open Questions: one question on the wall is lit at a time, moving on every few seconds while
// the wall is on screen; pointing at a question lights it instead.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: every question in full ink
  const wall = document.querySelector('.wall');
  const qs = [...wall.children];
  let k = 0, held = false, visible = true;
  const light = (i) => { k = i; qs.forEach((q, j) => q.classList.toggle('is-lit', j === i)); };
  wall.classList.add('is-on');
  light(0);
  qs.forEach((q, i) => {
    q.addEventListener('pointerenter', () => { held = true; light(i); });
    q.addEventListener('pointerleave', () => { held = false; });
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wall);
  setInterval(() => { if (visible && !held && !document.hidden) light((k + 1) % qs.length); }, 2400);
})();
