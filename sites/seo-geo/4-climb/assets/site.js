// Climb: a "Your site" tag climbs the ladder one rung at a time, lighting each rung it passes,
// holds at the top, then starts again from the bottom. Without JS or with reduced motion every
// rung is lit and the tag is not shown.
(() => {
  if (!document.documentElement.classList.contains('motion')) return;
  const frame = document.querySelector('.ladder__frame');
  const you = frame.querySelector('.ladder__you');
  const rungs = [...frame.querySelectorAll('.ladder__rungs li')].reverse(); // bottom first
  let k = 0, visible = true;
  const place = () => {
    const r = rungs[k];
    const x = frame.clientWidth * 0.14 + 4 - you.offsetWidth / 2;
    const y = r.offsetTop + r.offsetHeight / 2 - you.offsetHeight / 2;
    you.style.transform = `translate(${Math.max(0, x)}px, ${y}px)`;
    rungs.forEach((el, i) => el.classList.toggle('is-lit', i <= k));
  };
  place();
  addEventListener('resize', place);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(frame);
  const tick = () => {
    let wait = 650;
    if (visible && !document.hidden) {
      if (k < rungs.length - 1) { k++; place(); if (k === rungs.length - 1) wait = 2600; }
      else {
        you.style.opacity = '0';
        setTimeout(() => { you.style.transition = 'none'; k = 0; place(); you.offsetWidth; you.style.transition = ''; you.style.opacity = '1'; }, 300);
        wait = 900;
      }
    }
    setTimeout(tick, wait);
  };
  setTimeout(tick, 500);
})();
