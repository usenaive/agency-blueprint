// The route: draw a path through every checkpoint pin, then walk it. Each checkpoint is ticked as
// the walker passes; at rest the walker sets off again now and then. Reduced motion: the route is
// drawn and every checkpoint is ticked, nothing moves.
(() => {
  const map = document.querySelector('.map');
  if (!map) return;
  const motion = document.documentElement.classList.contains('motion');
  const svg = map.querySelector('.map__svg');
  const base = svg.querySelector('.map__base');
  const line = svg.querySelector('.map__line');
  const walker = map.querySelector('.walker');
  const cps = [...map.querySelectorAll('.cp')];
  let marks = []; // path length at each checkpoint

  const layout = () => {
    const box = map.getBoundingClientRect();
    const pts = cps.map((cp) => {
      const r = cp.querySelector('.pin').getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    });
    let d = `M${pts[0]}`;
    marks = [0];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const flat = Math.abs(x1 - x0) > Math.abs(y1 - y0);
      const c = flat ? `${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1}` : `${x0},${(y0 + y1) / 2} ${x1},${(y0 + y1) / 2}`;
      d += ` C${c} ${x1},${y1}`;
      base.setAttribute('d', d);
      marks.push(base.getTotalLength());
    }
    line.setAttribute('d', d);
    line.style.strokeDasharray = `${marks.at(-1)}`;
  };
  const show = (len) => {
    line.style.strokeDashoffset = `${marks.at(-1) - len}`;
    const p = base.getPointAtLength(len);
    walker.style.transform = `translate(${p.x}px, ${p.y}px)`;
    cps.forEach((cp, i) => {
      cp.classList.toggle('is-off', len < marks[i] - 1);
      cp.classList.toggle('is-here', Math.abs(len - marks[i]) < 18);
    });
  };

  layout();
  let at = marks.at(-1);
  show(at);
  const relayout = () => { layout(); show(Math.min(at, marks.at(-1))); };
  new ResizeObserver(relayout).observe(map);
  document.fonts?.ready.then(relayout);
  if (!motion) return;

  // Walk from start to finish in `ms`, easing in and out of each checkpoint.
  let walking = false;
  const walk = (ms) => new Promise((done) => {
    walking = true;
    walker.classList.add('is-on');
    const t0 = performance.now(), n = marks.length - 1;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms) * n;
      const i = Math.min(n - 1, Math.floor(t)), f = t - i;
      const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
      at = marks[i] + (marks[i + 1] - marks[i]) * e;
      show(at);
      if (t < n) requestAnimationFrame(step);
      else { walking = false; walker.classList.remove('is-on'); cps.at(-1).classList.remove('is-here'); done(); }
    };
    requestAnimationFrame(step);
  });

  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(map);
  setTimeout(() => walk(2000), 300);
  setInterval(() => { if (visible && !document.hidden && !walking) walk(5600); }, 9000);
})();
