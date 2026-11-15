// Type and timestamp: the session log types each note in against a session clock, then the clock
// keeps running and the caret waits on the last line. Reduced motion: the finished log.
(() => {
  const log = document.querySelector('.log');
  if (!log || !document.documentElement.classList.contains('motion')) return;
  const clock = log.querySelector('[data-clock]');
  const lines = [...log.querySelectorAll('.line')];
  const texts = lines.map((l) => l.querySelector('.line__x'));
  const full = texts.map((t) => t.textContent);
  const stamps = lines.map((l) => l.querySelector('.line__t'));
  const secs = stamps.map((s) => { const [m, x] = s.textContent.split(':').map(Number); return m * 3600 + x * 60; });
  const fmt = (s) => [s / 3600, (s / 60) % 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let now = 0;
  (async () => {
    await (document.fonts ? document.fonts.ready : null);
    texts.forEach((t) => { t.style.minHeight = `${t.offsetHeight}px`; t.textContent = ''; });
    stamps.forEach((s) => { s.style.visibility = 'hidden'; });
    clock.textContent = fmt(0);
    // Each line keeps its height while it types, so the card does not jump.
    await wait(150);
    const per = Math.max(4, Math.min(14, 1000 / full.join('').length));
    for (let i = 0; i < lines.length; i++) {
      const from = now, to = secs[i], steps = 6;
      for (let k = 1; k <= steps; k++) { now = Math.round(from + ((to - from) * k) / steps); clock.textContent = fmt(now); await wait(10); }
      stamps[i].style.visibility = '';
      lines[i].classList.add('is-typing');
      for (let c = 1; c <= full[i].length; c++) { texts[i].textContent = full[i].slice(0, c); await wait(per); }
      lines[i].classList.remove('is-typing');
    }
    log.classList.add('is-done');
    setInterval(() => { if (!document.hidden) clock.textContent = fmt(++now); }, 1000);
  })();
})();
