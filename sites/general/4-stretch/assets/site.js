// Stretch: every discipline is set on one line and stretched along Anybody's width axis until
// it fills the measure exactly. On load the lines stretch out from narrow outlines; under the
// pointer the stack bulges, the line nearest at full width and the rest squeezed.
// Without JS the lines simply wrap at a fixed width.
(() => {
  const stack = document.querySelector('[data-stack]');
  if (!stack || !document.fonts) return;
  const rows = [...stack.children];
  const words = rows.map((li) => li.firstElementChild);
  const motion = document.documentElement.classList.contains('motion');
  let fits = [];

  const fit = () => {
    stack.classList.add('fit');
    const width = stack.clientWidth;
    fits = words.map((w) => {
      w.style.transition = 'none';
      w.style.fontSize = '';
      w.style.fontStretch = '100%';
      let lo = 50, hi = 150;
      for (let k = 0; k < 9; k++) {
        const mid = (lo + hi) / 2;
        w.style.fontStretch = `${mid}%`;
        if (w.scrollWidth > width) hi = mid; else lo = mid;
      }
      w.style.fontStretch = `${lo}%`;
      // Too wide even at the narrowest, or too short even at the widest: change the size.
      const ratio = width / w.scrollWidth;
      if (ratio < 1 || lo > 149) {
        w.style.fontSize = `${parseFloat(getComputedStyle(w).fontSize) * Math.min(ratio * 0.99, 2)}px`;
      }
      void w.offsetWidth;
      w.style.transition = '';
      return lo;
    });
  };

  const squeeze = (y) => {
    rows.forEach((li, i) => {
      const r = li.getBoundingClientRect();
      const d = Math.abs(y - (r.top + r.height / 2)) / r.height;
      const k = y === null ? 1 : 1 - 0.38 * Math.min(1, d / 2.5);
      words[i].style.fontStretch = `${Math.max(50, fits[i] * k)}%`;
      li.classList.toggle('hot', y !== null && d < 0.5);
    });
  };

  document.fonts.ready.then(() => {
    fit();
    if (motion) {
      stack.classList.add('intro');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        words.forEach((w, i) => { w.style.transitionDelay = `${i * 70}ms`; });
        stack.classList.remove('intro');
        setTimeout(() => words.forEach((w) => { w.style.transitionDelay = ''; }), 1200);
      }));
      stack.addEventListener('pointermove', (e) => squeeze(e.clientY));
      stack.addEventListener('pointerleave', () => squeeze(null));
    }
    let t = 0;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fit, 120); });
  });
})();
