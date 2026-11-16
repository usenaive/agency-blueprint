// Settle and clear: the gate holds the release while each journey is checked, then the barrier
// lifts and the release moves through. At rest a new release arrives now and then and is checked
// again, slowly. Reduced motion: the gate stays open with every journey checked.
(() => {
  const gate = document.querySelector('.gate');
  if (!gate || !document.documentElement.classList.contains('motion')) return;
  const checks = [...gate.querySelectorAll('.check')];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let busy = false, visible = true;
  const cycle = async (step, first) => {
    busy = true;
    gate.classList.remove('is-clear');
    checks.forEach((c) => c.classList.add('is-off'));
    await wait(first ? 250 : 1300);
    for (const c of checks) { await wait(step); c.classList.remove('is-off'); }
    await wait(step);
    gate.classList.add('is-clear');
    await wait(1200);
    busy = false;
  };
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(gate);
  // The token returns to the start without crossing back through the barrier.
  const token = gate.querySelector('.gate__token');
  const again = async () => {
    if (busy || !visible || document.hidden) return;
    token.style.transition = 'opacity 0.5s';
    token.style.opacity = '0';
    await wait(500);
    gate.classList.remove('is-clear');
    await wait(60);
    token.style.opacity = '1';
    await wait(300);
    token.style.transition = '';
    cycle(420, false);
  };
  cycle(120, true);
  setInterval(again, 12000);
})();
