// Terminal: the query log types the four research commands; each one that finishes moves the
// desk (coverage meters fill, the demand chart goes live). At rest a crosshair reads the chart,
// the ticker runs, the method pipeline cycles and the status bar keeps the visitor's time.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: a still desk
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const io = 'IntersectionObserver' in window;

  const clock = document.querySelector('[data-clock]');
  const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); };
  tick(); setInterval(tick, 1000);

  const cov = document.querySelector('.cov');
  const chart = document.querySelector('.chart');
  const consoleEl = document.querySelector('.console');
  const rows = [...consoleEl.querySelectorAll('.log li')];
  const cmds = rows.map((li) => li.querySelector('.cmd'));
  const texts = cmds.map((c) => c.textContent);
  const after = [() => cov.classList.add('is-on'), () => {}, () => live(), () => {}];

  consoleEl.classList.add('is-typing');
  cmds.forEach((c) => { c.textContent = ''; });
  (async () => {
    await wait(200);
    for (let i = 0; i < cmds.length; i++) {
      for (let n = 1; n <= texts[i].length; n++) { cmds[i].textContent = texts[i].slice(0, n); await wait(8); }
      await wait(90);
      rows[i].classList.add('is-done');
      after[i]();
    }
  })();

  // The crosshair walks the trace; the line's points are read once from the path.
  function live() {
    const plot = chart.querySelector('.chart__plot');
    const cross = chart.querySelector('.cross');
    const dot = chart.querySelector('.dot');
    const pts = chart.querySelector('.trace').getAttribute('d').match(/[\d.]+ [\d.]+/g).map((p) => p.split(' ').map(Number));
    chart.classList.add('is-live');
    let visible = true;
    if (io) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(chart);
    const t0 = performance.now();
    const frame = (now) => {
      if (visible && !document.hidden) {
        const u = (Math.sin((now - t0) / 2600 - Math.PI / 2) + 1) / 2; // ease back and forth
        const x = u * 480;
        const k = Math.min(pts.length - 2, Math.floor(x / 40));
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        const y = y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
        cross.setAttribute('x1', x); cross.setAttribute('x2', x);
        dot.style.transform = `translate(${(x / 480) * plot.clientWidth}px, ${(y / 200) * plot.clientHeight}px)`;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const pipe = document.querySelector('.pipe');
  if (io) new IntersectionObserver(([e], o) => { if (e.isIntersecting) { pipe.classList.add('is-run'); o.disconnect(); } }, { rootMargin: '0px 0px -20% 0px' }).observe(pipe);
  else pipe.classList.add('is-run');
})();
