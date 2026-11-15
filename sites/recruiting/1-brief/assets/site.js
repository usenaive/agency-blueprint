// Brief: blue-pencil mark-up. Each section's marks are drawn as SVG strokes over the text,
// measured from the real line boxes, so they fit any filled-in copy. Content never depends on this.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 64rem)');
  const sets = [...document.querySelectorAll('[data-set]')];
  const drawn = new Set();
  let seed = 7;
  const j = (a) => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 2 * a; };
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const n = (v) => Math.round(v * 10) / 10;

  // Catmull-Rom through points, as cubic Beziers: a hand stroke, not a polygon.
  const smooth = (p) => {
    let d = `M${n(p[0][0])} ${n(p[0][1])}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c;
      d += `C${n(b[0] + (c[0] - a[0]) / 6)} ${n(b[1] + (c[1] - a[1]) / 6)} ${n(c[0] - (e[0] - b[0]) / 6)} ${n(c[1] - (e[1] - b[1]) / 6)} ${n(c[0])} ${n(c[1])}`;
    }
    return d;
  };

  // One box per rendered line of text, in page coordinates.
  const lines = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const out = [];
    for (const b of range.getClientRects()) {
      if (b.width < 2) continue;
      const r = { left: b.left + scrollX, right: b.right + scrollX, top: b.top + scrollY, bottom: b.bottom + scrollY };
      const same = out.find((o) => Math.abs((o.top + o.bottom) / 2 - (r.top + r.bottom) / 2) < 8);
      if (same) Object.assign(same, { left: Math.min(same.left, r.left), right: Math.max(same.right, r.right), top: Math.min(same.top, r.top), bottom: Math.max(same.bottom, r.bottom) });
      else out.push(r);
    }
    return out;
  };
  const unite = (rs) => rs.reduce((u, r) => ({ left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top), bottom: Math.max(u.bottom, r.bottom) }));
  const grow = (r, x, y) => ({ left: r.left - x, right: r.right + x, top: r.top - y, bottom: r.bottom + y });

  const under = (r, drop = 0) => {
    const h = r.bottom - r.top, w = r.right - r.left, y = r.bottom - h * 0.1 + drop;
    const pts = [], k = Math.max(3, Math.round(w / 140)), sag = Math.min(4, w / 120);
    for (let i = 0; i <= k; i++) { const t = i / k; pts.push([r.left - 4 + t * (w + 10), y + Math.sin(t * Math.PI) * sag - t * 3 + j(1.2)]); }
    return smooth(pts);
  };
  const ring = (r) => {
    const h = r.bottom - r.top, w = r.right - r.left;
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, rx = w / 2 + Math.max(10, h * 0.28), ry = h / 2 + Math.max(7, h * 0.16);
    const pts = [];
    for (let i = 0; i <= 15; i++) {
      const a = -2.3 + (i / 15) * (Math.PI * 2 + 0.55), s = 1 + j(0.03) + i * 0.004;
      pts.push([cx + Math.cos(a) * rx * s, cy + Math.sin(a) * ry * s - i * 0.25]);
    }
    return smooth(pts);
  };
  const arrow = (A, B) => {
    const gx = Math.max(B.left - A.right, A.left - B.right), gy = Math.max(B.top - A.bottom, A.top - B.bottom);
    let s, e;
    if (gx >= gy) {
      const left = B.right <= A.left;
      s = [left ? A.left - 8 : A.right + 8, (A.top + A.bottom) / 2];
      e = [left ? B.right + 8 : B.left - 8, clamp(s[1], B.top + 6, B.bottom - 6)];
    } else {
      const up = B.bottom <= A.top;
      s = [A.left + Math.min((A.right - A.left) / 2, 36), up ? A.top - 6 : A.bottom + 6];
      e = [clamp(s[0] - 70, B.left + 24, B.right - 24), up ? B.bottom + 10 : B.top - 10];
    }
    const dx = e[0] - s[0], dy = e[1] - s[1], L = Math.hypot(dx, dy) || 1, k = Math.min(L * 0.25, 46);
    const f = dx >= 0 ? 1 : -1; // bow the stroke upward, the way a hand swings an arrow
    const c = [(s[0] + e[0]) / 2 + f * (dy / L) * k, (s[1] + e[1]) / 2 - f * (dx / L) * k];
    const t = Math.atan2(e[1] - c[1], e[0] - c[0]), h = 11;
    const tip = (o) => `${n(e[0] - h * Math.cos(t + o))} ${n(e[1] - h * Math.sin(t + o))}`;
    return [`M${n(s[0])} ${n(s[1])}Q${n(c[0])} ${n(c[1])} ${n(e[0])} ${n(e[1])}`, `M${tip(0.5)}L${n(e[0])} ${n(e[1])}L${tip(-0.5)}`];
  };

  const marks = {
    underline: (el) => lines(el).map((r) => under(r)),
    double: (el) => {
      const ls = lines(el), last = ls[ls.length - 1], w = last.right - last.left;
      return [...ls.map((r) => under(r)), under({ ...last, left: last.left + w * 0.08, right: last.right - w * 0.04 }, 10)];
    },
    wavy: (el) => lines(el).map((r) => {
      const y = r.bottom + 2, pts = [];
      for (let x = r.left, i = 0; x <= r.right + 6; x += 13, i++) pts.push([x, y + (i % 2 ? 2.6 : -2.6) + j(0.6)]);
      return smooth(pts);
    }),
    circle: (el) => [ring(unite(lines(el)))],
    tick: (el) => {
      const r = lines(el)[0], x = r.left - 34, y = (r.top + r.bottom) / 2;
      return [`M${n(x)} ${n(y + j(1))}Q${n(x + 4)} ${n(y + 4)} ${n(x + 8)} ${n(y + 9)}Q${n(x + 13)} ${n(y - 4)} ${n(x + 24)} ${n(y - 13 + j(1.5))}`];
    },
    bracket: (el) => {
      const b = el.getBoundingClientRect(), u = unite(lines(el));
      const right = wide.matches, x = right ? b.right + scrollX + 22 : u.left - 10, o = right ? -7 : 7;
      return [smooth([[x + o, u.top + 2], [x, u.top + 10], [x + j(1), (u.top + u.bottom) / 2], [x, u.bottom - 10], [x + o, u.bottom - 2]])];
    },
  };

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'marks');
  svg.setAttribute('aria-hidden', 'true');
  document.body.append(svg);

  const stroke = (g, d, at) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('pathLength', '1');
    g.append(p);
    const t = clamp(p.getTotalLength() / 800, 0.2, 0.7);
    p.style.cssText = `--d:${at.toFixed(2)}s;--t:${t.toFixed(2)}s`;
    return at + t * 0.7;
  };

  function build() {
    seed = 7;
    svg.replaceChildren();
    svg.setAttribute('height', 0);
    svg.setAttribute('width', root.clientWidth);
    for (const sec of sets) {
      const g = document.createElementNS(NS, 'g');
      if (drawn.has(sec)) g.classList.add('on');
      svg.append(g);
      sec.mark = g;
      let at = sec.classList.contains('hero') ? 0.45 : 0.15;
      for (const el of sec.querySelectorAll('[data-mark], .note')) {
        if (el.dataset.mark) for (const d of marks[el.dataset.mark](el)) at = stroke(g, d, at);
        if (el.classList.contains('note')) { at = Math.min(at, 1.2); el.style.setProperty('--nd', `${at.toFixed(2)}s`); at += 0.55; }
        const to = document.getElementById(el.dataset.arrowTo || '');
        if (!to || !(wide.matches || 'phone' in el.dataset)) continue;
        const from = unite(lines(el)), target = unite(lines(to));
        const A = el.dataset.mark === 'circle' ? grow(from, 18, 12) : from;
        const B = to.dataset.mark === 'circle' ? grow(target, 18, 12) : to.dataset.mark ? grow(target, 4, 8) : target;
        for (const d of arrow(A, B)) at = stroke(g, d, at);
      }
    }
    svg.setAttribute('height', document.body.scrollHeight);
  }

  // Hover marks: a ring for actions, an underline for the section links.
  function hovers() {
    for (const el of document.querySelectorAll('[data-hm]')) {
      el.querySelector(':scope > .hm')?.remove();
      const w = el.offsetWidth, h = el.offsetHeight, s = document.createElementNS(NS, 'svg');
      s.setAttribute('class', 'hm');
      s.setAttribute('aria-hidden', 'true');
      s.setAttribute('width', w + 24);
      s.setAttribute('height', h + 24);
      const r = { left: 12, top: 12, right: 12 + w, bottom: 12 + h };
      seed = 11;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', el.dataset.hm === 'circle' ? ring(grow(r, -4, -6)) : under({ ...r, left: r.left + 3, right: r.right - 6 }, -2));
      p.setAttribute('pathLength', '1');
      s.append(p);
      el.append(s);
    }
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      drawn.add(e.target);
      e.target.classList.add('is-on');
      e.target.mark.classList.add('on');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -22% 0px' });

  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { build(); hovers(); }, 120); };

  document.fonts.ready.then(() => {
    if (still) sets.forEach((s) => { drawn.add(s); s.classList.add('is-on'); });
    build();
    hovers();
    if (!still) sets.forEach((s) => io.observe(s));
    addEventListener('resize', refresh);
  });
})();
