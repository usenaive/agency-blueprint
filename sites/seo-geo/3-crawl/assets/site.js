// Crawl: a crawler walks the sitemap depth first, lighting each page pink as it reaches it, then
// starts again. Without JS or with reduced motion every page is drawn as already reached.
(() => {
  if (!document.documentElement.classList.contains('motion')) return;
  const map = document.querySelector('.map__svg');
  const bot = map.querySelector('.bot');
  const nodes = [...map.querySelectorAll('.node')];
  const at = nodes.map((n) => n.getAttribute('transform').match(/[\d.]+/g).map(Number));
  const route = [0, 1, 2, 1, 3, 1, 4, 1, 5, 1, 0, 6, 7, 6, 8, 6, 9, 6, 0, 10, 11, 10, 12, 10, 0];
  let i = 0, visible = true;
  bot.removeAttribute('transform');
  const go = (n) => { bot.style.transform = `translate(${at[n][0]}px, ${at[n][1]}px)`; nodes[n].classList.add('is-seen'); };
  go(0);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(map);
  const tick = () => {
    if (visible && !document.hidden) {
      i = (i + 1) % route.length;
      if (i === 0) nodes.forEach((n, k) => k && n.classList.remove('is-seen'));
      go(route[i]);
    }
    setTimeout(tick, i === route.length - 1 ? 2200 : 360);
  };
  setTimeout(tick, 400);
})();
