// Run the suites: each journey goes queued, running, passed; one finds an issue, gets reported
// and rechecked. At rest one suite re-runs now and then while the report is on screen.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: the finished report
  const io = 'IntersectionObserver' in window;
  const stages = document.querySelectorAll('.stage');
  if (io) {
    const obs = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -15% 0px' });
    stages.forEach((s) => obs.observe(s));
  } else stages.forEach((s) => s.classList.add('is-in'));

  const run = document.querySelector('.run');
  if (!run) return;
  const suites = [...run.querySelectorAll('.suite')];
  const bars = [...run.querySelectorAll('.run__bar span')];
  const summary = run.querySelector('[data-summary]');
  const times = suites.map((s) => s.querySelector('.suite__t'));
  const final = times.map((t) => t.textContent);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const set = (i, s) => { suites[i].dataset.s = s; bars[i].dataset.s = s; };
  const tick = async (i, ms) => {
    set(i, 'running');
    const t0 = performance.now();
    const id = setInterval(() => { times[i].textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`; }, 100);
    await wait(ms);
    clearInterval(id);
  };
  const say = (text, cls) => { summary.textContent = text; summary.className = `pill ${cls}`; };

  suites.forEach((_, i) => { set(i, 'queued'); times[i].textContent = ''; });
  say('Running', 'pill--skip');
  (async () => {
    await wait(250);
    for (let i = 0; i < suites.length; i++) { await tick(i, 220 + (i % 3) * 60); set(i, 'pass'); times[i].textContent = final[i]; }
    say('All journeys passing', 'pill--pass');

    let visible = true;
    if (io) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(run);
    // At rest: suites re-run in turn; every sixth re-run finds an issue that is reported and rechecked.
    const order = [3, 1, 5, 0, 4, 2];
    let k = 0, busy = false;
    setInterval(async () => {
      if (!visible || document.hidden || busy) return;
      busy = true;
      const i = order[k % order.length];
      await tick(i, 900);
      if (k++ % order.length === 0) {
        set(i, 'fail'); say('1 issue found', 'pill--fail'); run.classList.add('is-noting');
        await wait(2600);
        run.classList.remove('is-noting');
        await tick(i, 900);
        say('All journeys passing', 'pill--pass');
      }
      set(i, 'pass'); times[i].textContent = final[i];
      busy = false;
    }, 3600);
  })();
})();
