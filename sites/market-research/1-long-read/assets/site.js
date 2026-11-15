// Long Read: Figure 1 plots itself once the type is set, the small multiples draw as they come
// into view, and Figure 3 follows the method steps: gathered, sorted, then read as a finding.
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('motion')) return; // reduced motion: every figure in its final state
  const io = 'IntersectionObserver' in window;

  const waffle = document.querySelector('.fig--waffle');
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    requestAnimationFrame(() => waffle.classList.add('is-on'));
    setTimeout(() => waffle.classList.add('is-idle'), 1800);
  });

  const wide = document.querySelector('.fig--wide');
  if (io) {
    const once = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-on'); once.unobserve(e.target); }
    }), { rootMargin: '0px 0px -20% 0px' });
    once.observe(wide);
  } else wide.classList.add('is-on');

  const fig = document.querySelector('.fig--dots');
  const cap = fig.querySelector('[data-cap]');
  const caps = ['', 'Every answer gathered, before any of it is sorted.', 'The same answers, sorted into themes.', cap.textContent];
  const steps = [...document.querySelectorAll('.step')];
  const show = (n) => {
    fig.dataset.state = n;
    cap.textContent = caps[n];
    steps.forEach((s) => s.classList.toggle('is-cur', s.dataset.step === String(n)));
  };
  if (!io) return;
  show(1);
  const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) show(Number(e.target.dataset.step)); }),
    { rootMargin: '-40% 0px -50% 0px' });
  steps.forEach((s) => obs.observe(s));
})();
