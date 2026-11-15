// Connect and settle: sections draw their connectors as they enter; the hero chart fills its
// open seats one by one, then one seat at a time opens and is filled again while the chart is on screen.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('motion')) return; // reduced motion: everything is drawn and filled
  const sections = document.querySelectorAll('[data-connect]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    sections.forEach((s) => io.observe(s));
  } else sections.forEach((s) => s.classList.add('is-in'));

  const chart = document.querySelector('.chart');
  if (!chart) return;
  const seats = [...chart.querySelectorAll('.seat')];
  seats.forEach((s) => s.classList.add('is-open'));
  requestAnimationFrame(() => requestAnimationFrame(() => chart.classList.remove('pre')));
  seats.forEach((s, i) => setTimeout(() => s.classList.remove('is-open'), 1150 + i * 170));

  let onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(chart);
  const order = [4, 1, 5, 0, 3, 2];
  let k = 0;
  const cycle = () => {
    if (!onScreen || document.hidden) return;
    const seat = seats[order[k++ % order.length]];
    seat.classList.add('is-open');
    setTimeout(() => seat.classList.remove('is-open'), 1700);
  };
  setTimeout(() => { cycle(); setInterval(cycle, 3400); }, 2200);
})();
