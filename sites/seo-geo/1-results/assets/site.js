// Results: the query types itself into the box, the page loads, then the results arrive in
// order. Without JS or with reduced motion the query and every result are simply there.
(() => {
  if (!document.documentElement.classList.contains('motion')) return;
  const text = document.querySelector('[data-type]');
  const serp = document.querySelector('.serp');
  const full = text.textContent;
  const step = Math.min(48, 1100 / full.length);
  serp.classList.add('is-waiting');
  text.textContent = '';
  let i = 0;
  const type = () => {
    text.textContent = full.slice(0, ++i);
    if (i < full.length) return setTimeout(type, step);
    serp.classList.add('is-loading');
    setTimeout(() => serp.classList.remove('is-waiting'), 420);
  };
  setTimeout(type, 350);
})();
