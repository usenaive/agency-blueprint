// Media Plan: when the plan comes into view its bars are drawn in, row by row, as if a planner
// were filling the sheet; then a cell cursor keeps moving over the weeks, selecting one cell at
// a time, while the sheet is on screen. Pointing at a row holds the cursor on it.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: the plan as drawn
  const plan = document.querySelector('.plan');
  const sheet = plan.querySelector('.sheet');
  const cursor = sheet.querySelector('.cursor');
  const rows = [...sheet.querySelectorAll('.row')];
  let visible = false, held = null, timer;
  const select = (row, week) => {
    const wk = row.querySelector('.row__wk');
    const s = sheet.getBoundingClientRect(), r = wk.getBoundingClientRect();
    const w = r.width / 12;
    cursor.style.transform = `translate(${r.left - s.left + w * week - 1}px, ${r.top - s.top - 1}px)`;
    cursor.style.width = `${w + 2}px`;
    cursor.style.height = `${r.height + 2}px`;
    cursor.classList.add('is-on');
  };
  const step = () => {
    if (!visible || document.hidden) return;
    const row = held ?? rows[Math.floor(Math.random() * rows.length)];
    select(row, Math.floor(Math.random() * 12));
  };
  rows.forEach((row) => {
    row.addEventListener('pointerenter', () => { held = row; step(); });
    row.addEventListener('pointerleave', () => { held = null; });
  });
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !plan.classList.contains('is-on')) { plan.classList.add('is-on'); setTimeout(step, 1400); }
    clearInterval(timer);
    if (visible) timer = setInterval(step, 1600);
  }, { threshold: 0.25 }).observe(plan);
})();
