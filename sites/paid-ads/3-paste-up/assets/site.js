// Paste-up: the hero posters are pasted up on load (CSS). Below it, each poster settles flat
// against the wall as it reaches the screen, like paper smoothed with a brush.
(() => {
  if (!document.documentElement.classList.contains('motion') || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.2 });
  document.querySelectorAll('main > :not(.wall) .paste').forEach((el) => io.observe(el));
})();
