// Module: one point of contact settles on each discipline in turn (the client's one lead,
// moving between the specialists), stops on the module under the pointer or focus, and a
// Pause button stops it. "Show the grid" draws the twelve columns everything sits on.
(() => {
  const root = document.documentElement;
  const btn = document.querySelector('.gridbtn');
  if (btn) {
    btn.hidden = false;
    document.querySelectorAll('.cols-overlay span').forEach((s, i) => s.style.setProperty('--i', i));
    btn.addEventListener('click', () => {
      const on = root.classList.toggle('show-grid');
      btn.setAttribute('aria-pressed', String(on));
      btn.lastElementChild.textContent = on ? 'Hide the grid' : 'Show the grid';
    });
  }

  const board = document.querySelector('.field__board');
  const dot = document.querySelector('.contact-dot');
  const mods = [...document.querySelectorAll('.mod')];
  if (!board || !dot || !mods.length) return;
  let i = 0, paused = false, held = false, visible = true;
  const land = (n) => {
    i = n;
    mods.forEach((m, k) => m.classList.toggle('on', k === n));
    const m = mods[n];
    dot.style.left = `${m.offsetLeft + m.offsetWidth - 26}px`;
    dot.style.top = `${m.offsetTop + 10}px`;
  };
  land(0);
  addEventListener('resize', () => land(i));
  mods.forEach((m, k) => {
    m.addEventListener('pointerenter', () => { held = true; land(k); });
    m.addEventListener('pointerleave', () => { held = false; });
  });
  if (!root.classList.contains('motion')) return;
  const pause = document.querySelector('.pause');
  pause.hidden = false;
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.textContent = paused ? 'Play' : 'Pause';
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(board);
  setInterval(() => { if (!paused && !held && visible) land((i + 1) % mods.length); }, 2600);
})();
