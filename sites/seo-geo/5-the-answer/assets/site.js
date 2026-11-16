// Be the Answer: each rewrite gets its red strike as it arrives on screen. In the hero the old
// habit keeps changing: it fades, a new one is written in, and the strike crosses it out again.
// Without JS or with reduced motion every strike is already drawn and the hero stays still.
(() => {
  if (!document.documentElement.classList.contains('motion')) return;
  const lines = document.querySelectorAll('.rewrite');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('is-in'), 250);
      io.unobserve(e.target);
    }
  }, { threshold: 0.6 });
  lines.forEach((l) => io.observe(l));

  const del = document.querySelector('[data-cycle]');
  const habits = [del.textContent, 'Be on page two.', 'Be a keyword.', 'Be another listing.', 'Be skipped by the answer.'];
  let k = 0;
  setInterval(() => {
    if (document.hidden) return;
    del.classList.add('is-out', 'is-gone');
    setTimeout(() => {
      k = (k + 1) % habits.length;
      del.textContent = habits[k];
      del.classList.remove('is-gone');
      setTimeout(() => del.classList.remove('is-out'), 350);
    }, 500);
  }, 3600);
})();
