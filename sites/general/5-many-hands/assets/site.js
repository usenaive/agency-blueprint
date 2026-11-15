// Many hands: the six cut-outs start scattered and gather into one composition around
// "one team" (gathered is the resting state, so without JS or with reduced motion the
// collage is simply assembled). The button scatters and gathers them again.
(() => {
  const stage = document.querySelector('[data-stage]');
  const btn = document.querySelector('.toggle');
  if (!stage || !btn || !document.documentElement.classList.contains('motion')) return;
  btn.hidden = false;
  const set = (scattered) => {
    stage.classList.toggle('scattered', scattered);
    btn.textContent = scattered ? 'Gather the pieces' : 'Scatter the pieces';
  };
  stage.classList.add('scattered');
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => set(false), 150)));
  btn.addEventListener('click', () => set(!stage.classList.contains('scattered')));
})();
