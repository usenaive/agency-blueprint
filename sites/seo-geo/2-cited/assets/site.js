// Cited: the answer streams in word by word, the rest of it settles, then the citations pop in.
// Pointing at a citation lights its source, and pointing at a source lights its citations.
(() => {
  const cites = [...document.querySelectorAll('.cite')];
  const sources = [...document.querySelectorAll('.sources li')];
  const hot = (n, on) => {
    cites.forEach((c) => c.classList.toggle('is-hot', on && c.dataset.src === n));
    sources.forEach((s) => s.classList.toggle('is-hot', on && s.dataset.src === n));
  };
  for (const el of [...cites, ...sources]) {
    for (const [ev, on] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false]]) {
      el.addEventListener(ev, () => hot(el.dataset.src, on));
    }
  }

  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: the whole answer at once
  const answer = document.querySelector('.answer');
  const words = [];
  for (const el of answer.querySelectorAll('[data-stream]')) {
    const parts = el.textContent.split(/(\s+)/);
    el.textContent = '';
    for (const part of parts) {
      if (/^\s*$/.test(part)) { el.append(part); continue; }
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      el.append(w);
      words.push(w);
    }
  }
  const start = [...answer.children].findIndex((c) => c.classList.contains('quote'));
  [...answer.children].slice(start).forEach((c) => c.classList.add('later'));
  answer.classList.add('is-streaming');
  const step = Math.min(70, 1300 / words.length);
  words.forEach((w, i) => setTimeout(() => w.classList.add('is-on'), 250 + i * step));
  setTimeout(() => answer.classList.remove('is-streaming'), 400 + words.length * step);
})();
