// Split Test: the hero is two variants of the same headline, split by a line. Drag the line
// (or use the arrow keys on the hidden slider) to compare them. Until someone touches it, the line
// drifts slowly back and forth, as a test does before it has a winner. The method fork draws in.
(() => {
  const stage = document.querySelector('.split__stage');
  const range = stage.querySelector('.split__range');
  const motion = document.documentElement.classList.contains('motion');
  let touched = false, visible = true, t0 = performance.now();
  const set = (x) => { x = Math.max(0, Math.min(100, x)); stage.style.setProperty('--x', `${x}%`); range.value = String(Math.round(x)); };
  const stop = () => { touched = true; };
  range.hidden = false;
  range.addEventListener('input', () => { stop(); set(Number(range.value)); });
  const at = (e) => { const r = stage.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  stage.querySelector('.divider').addEventListener('pointerdown', (e) => {
    stop(); e.preventDefault(); at(e);
    document.body.classList.add('is-dragging');
    const move = (ev) => at(ev);
    const up = () => { document.body.classList.remove('is-dragging'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  if (!motion) return; // reduced motion: the line rests at the middle until moved
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
    const fork = document.querySelector('.fork');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { fork.classList.add('is-on'); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(fork);
  }
  const drift = (now) => {
    if (touched) return;
    if (visible && !document.hidden) set(50 + 16 * Math.sin((now - t0) / 1900));
    requestAnimationFrame(drift);
  };
  requestAnimationFrame(drift);
})();
