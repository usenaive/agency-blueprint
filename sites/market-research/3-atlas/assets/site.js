// Atlas: once the type is set, competitor pins drop onto the plate, the unclaimed ground is
// traced and hatched, and the opening pin lands; at rest it keeps sending out a ripple.
(() => {
  if (!document.documentElement.classList.contains('motion')) return; // reduced motion: the finished plate
  const map = document.querySelector('.map');
  map.querySelectorAll('.pins circle').forEach((c, k) => c.style.setProperty('--k', k));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    map.classList.add('is-on');
    setTimeout(() => map.classList.add('is-idle'), 2800);
  });
})();
