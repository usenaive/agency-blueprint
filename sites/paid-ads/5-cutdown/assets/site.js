// Cutdown: a fifteen-second edit plays on a loop. The playhead runs along the timeline, the clip
// under it lights up and the program monitor shows its caption and timecode. Drag along the
// timeline (or tap a clip on a phone) to scrub; Pause stops the loop.
(() => {
  const LEN = 15;
  const body = document.querySelector('.tl__body');
  const mon = document.querySelector('.mon');
  const cap = mon.querySelector('.mon__cap span');
  const tc = mon.querySelector('.mon__tc');
  const bar = mon.querySelector('.mon__bar');
  const btn = document.querySelector('.tl__play');
  const clips = [...document.querySelectorAll('.clip')].map((el) => ({ el, at: Number(el.dataset.in), label: el.querySelector('.clip__l').textContent }));
  const motion = document.documentElement.classList.contains('motion');
  let t = 0, playing = motion, scrubbing = false, visible = true, last = performance.now(), current = null;
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const show = (time) => {
    t = (time + LEN) % LEN;
    const p = t / LEN;
    body.style.setProperty('--p', p);
    bar.style.setProperty('--p', p);
    tc.textContent = `00:00:${pad(t)}:${pad((t % 1) * 25)}`;
    const clip = clips.filter((c) => c.at <= t).pop();
    if (clip === current) return;
    current?.el.classList.remove('is-on');
    clip.el.classList.add('is-on');
    cap.textContent = clip.label;
    mon.className = `mon ${[...clip.el.classList].find((c) => c.startsWith('c-'))}`;
    current = clip;
  };
  const tick = (now) => {
    if (playing && !scrubbing && visible && !document.hidden) show(t + (now - last) / 1000);
    last = now;
    requestAnimationFrame(tick);
  };
  const at = (e) => {
    const head = body.querySelector('.playhead');
    if (!head.offsetParent) { const c = clips.find((c) => c.el.contains(e.target)); if (c) show(c.at + 0.01); return; }
    const lane = body.querySelector('.clips').getBoundingClientRect();
    show(Math.max(0, Math.min(0.999, (e.clientX - lane.left) / lane.width)) * LEN);
  };
  body.addEventListener('pointerdown', (e) => {
    scrubbing = true; at(e);
    const move = (ev) => at(ev);
    const up = () => { scrubbing = false; removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });
  show(0);
  if (!motion) return; // reduced motion: still, scrub by hand
  btn.hidden = false;
  btn.addEventListener('click', () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(document.querySelector('.edit'));
  requestAnimationFrame(tick);
})();
