// Feed: the hero feed scrolls on its own like a customer's thumb; pointing at an ad or pressing
// Pause stops it, and it rests while off screen. The three story bars fill in turn when seen.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: a still feed, full bars
  const feed = document.querySelector('.feed');
  const pause = feed.querySelector('.feed__pause');
  pause.hidden = false;
  pause.addEventListener('click', () => {
    const on = feed.classList.toggle('is-paused');
    pause.textContent = on ? 'Play' : 'Pause';
  });
  if (!('IntersectionObserver' in window)) return document.querySelector('.story').classList.add('is-on');
  new IntersectionObserver(([e]) => feed.classList.toggle('is-off', !e.isIntersecting)).observe(feed);
  const story = document.querySelector('.story');
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { story.classList.add('is-on'); io.disconnect(); } }, { threshold: 0.4 });
  io.observe(story);
})();
