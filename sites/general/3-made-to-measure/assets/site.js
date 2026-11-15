// Made to measure: the hoop sews its two words on load (CSS). Down the process, the red seam
// is sewn as far as the reader has read, with the needle at its end. Without JS or with reduced
// motion the seam is sewn the whole way.
(() => {
  if (!document.documentElement.classList.contains('motion')) return;
  const seam = document.querySelector('.seam');
  const sewn = document.querySelector('.seam__sewn');
  if (!seam || !sewn) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = seam.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
    sewn.style.setProperty('--p', p.toFixed(3));
    sewn.style.setProperty('--needle', p > 0.02 && p < 0.99 ? 1 : 0);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
})();
