// Departures: split-flap cells that cycle through glyphs, then lock. One ticker drives every flap.
(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&/.-";
  const rand = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
  const jobs = new Set();
  let running = false;

  const fold = (cell) => cell.animate(
    [{ transform: "perspective(240px) rotateX(-75deg)", opacity: 0.55 }, { transform: "none", opacity: 1 }],
    { duration: 90, easing: "ease-out" });

  const tick = (now) => {
    for (const j of jobs) {
      if (now < j.at) continue;
      j.cell.textContent = j.steps-- > 0 ? rand() : j.ch;
      if (motion) fold(j.cell);
      if (j.steps < 0) jobs.delete(j); else j.at = now + 55;
    }
    if (jobs.size) requestAnimationFrame(tick); else { running = false; done(); }
  };
  let waiters = [];
  const done = () => { const w = waiters; waiters = []; w.forEach((f) => f()); };

  // Flip cells to chars. Without motion they just lock.
  function flip(cells, chars, stagger = 22, steps = 6) {
    const now = performance.now();
    cells.forEach((cell, i) => {
      const ch = chars[i] ?? " ";
      if (!motion) { cell.textContent = ch; return; }
      if (cell.textContent === ch && ch === " ") return;
      for (const j of jobs) if (j.cell === cell) jobs.delete(j);
      jobs.add({ cell, ch, steps: ch === " " ? 2 : steps + ((Math.random() * 4) | 0), at: now + i * stagger });
    });
    if (motion && jobs.size && !running) { running = true; requestAnimationFrame(tick); }
    return new Promise((ok) => (jobs.size ? waiters.push(ok) : ok()));
  }

  const cell = (ch) => Object.assign(document.createElement("span"), { className: "f", textContent: ch });

  // Inline flap text: the real text stays in the DOM once (visually hidden), cells are aria-hidden.
  function flapify(el) {
    const text = el.textContent.trim();
    const sr = Object.assign(document.createElement("span"), { className: "sr", textContent: text });
    const vis = Object.assign(document.createElement("span"), { className: "fl" });
    vis.setAttribute("aria-hidden", "true");
    const cells = [], chars = [];
    for (const word of text.split(/\s+/)) {
      const w = Object.assign(document.createElement("span"), { className: "w" });
      for (const ch of word) { const c = cell(ch); w.append(c); cells.push(c); chars.push(ch); }
      vis.append(w);
    }
    el.replaceChildren(sr, vis);
    return () => flip(cells, chars, 18);
  }

  // Board table and route numbers re-flip (cycle, then lock on the same text) when they reach the viewport.
  // They never start blank, so a still capture always shows the real board.
  const io = motion && new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    e.target.classList.add("is-in");
    e.target._flip();
  }), { threshold: 0.25 });
  document.querySelectorAll("[data-reveal-board]").forEach((table) => {
    const fns = [...table.querySelectorAll("[data-flap]")].map((el) => flapify(el));
    table._flip = () => fns.forEach((f, i) => setTimeout(f, i * 140));
    if (io) io.observe(table);
  });
  document.querySelectorAll(".route__no").forEach((box) => {
    const f = flapify(box.querySelector("[data-flap]"));
    box._flip = () => f();
    if (io) io.observe(box);
  });

  // Primary buttons: the label flips on hover and focus.
  document.querySelectorAll("[data-flip]").forEach((btn) => {
    const text = btn.textContent.trim();
    const vis = document.createElement("span");
    vis.setAttribute("aria-hidden", "true");
    const cells = [...text].map((ch) => vis.appendChild(Object.assign(document.createElement("span"), { className: "ch", textContent: ch })));
    btn.setAttribute("aria-label", text);
    btn.replaceChildren(vis);
    const go = () => { if (motion) flip(cells.filter((c) => c.textContent !== " "), [...text].filter((c) => c !== " "), 14, 3); };
    btn.addEventListener("pointerenter", go);
    btn.addEventListener("focus", () => btn.matches(":focus-visible") && go());
  });

  // The hero board: a fixed grid of flaps that cycles through the specialties, word-wrapped like a real board.
  const board = document.querySelector("[data-board]");
  const grid = board && board.querySelector("[data-flaps]");
  const specs = [...document.querySelectorAll("[data-spec]")].map((el) => (el.querySelector(".sr") || el).textContent.trim().toUpperCase());
  if (!motion || !grid || !specs.length) return;

  const count = board.querySelector("[data-count]");
  const pause = board.querySelector("[data-pause]");
  let cells = [], cols = 0, rows = 0, index = 0, playing = true, visible = true, timer = 0, width = 0;

  const wrap = (text) => {
    const lines = [];
    let cur = "";
    for (let w of text.split(/\s+/)) {
      while (w.length > cols) { if (cur) lines.push(cur), (cur = ""); lines.push(w.slice(0, cols)); w = w.slice(cols); }
      if (!w) continue;
      if (!cur) cur = w; else if (cur.length + 1 + w.length <= cols) cur += " " + w; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const charsFor = (text) => {
    const lines = wrap(text), out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push((lines[r] || "")[c] || " ");
    return out;
  };
  const label = () => { count.textContent = String(index + 1).padStart(2, "0") + " / " + String(specs.length).padStart(2, "0"); };

  function build() {
    width = grid.clientWidth;
    const gap = width < 600 ? 3 : 5;
    const target = width < 600 ? 26 : 50;
    const pad = parseFloat(getComputedStyle(grid).paddingLeft) * 2;
    const inner = width - pad;
    cols = Math.max(8, Math.floor((inner + gap) / (target + gap)));
    rows = Math.max(...specs.map((s) => wrap(s).length));
    const cw = (inner - gap * (cols - 1)) / cols;
    grid.style.setProperty("--cols", cols);
    grid.style.setProperty("--fg", gap + "px");
    grid.style.setProperty("--fs", (cw * 1.22).toFixed(1) + "px");
    const chars = charsFor(specs[index]);
    cells = chars.map((ch) => cell(ch));
    grid.replaceChildren(...cells);
  }

  const schedule = () => { clearTimeout(timer); if (playing && visible) timer = setTimeout(next, 2600); };
  async function next() {
    index = (index + 1) % specs.length;
    label();
    await flip(cells, charsFor(specs[index]), 16, 5);
    schedule();
  }

  build();
  label();
  pause.hidden = false;
  pause.addEventListener("click", () => {
    playing = !playing;
    pause.setAttribute("aria-pressed", String(!playing));
    pause.textContent = playing ? "Pause board" : "Play board";
    schedule();
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); }).observe(board);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; schedule(); });
  new ResizeObserver(() => { if (Math.abs(grid.clientWidth - width) > 4) { jobs.clear(); done(); build(); } }).observe(grid);
  // Open on a blank board, then flip the first role in.
  const first = cells.map((c) => c.textContent);
  cells.forEach((c) => (c.textContent = " "));
  setTimeout(() => flip(cells, first, 16, 5).then(schedule), 250);
})();

// Fit the hero name: shrink only when one unbreakable word is wider than the column.
(() => {
  const el = document.querySelector("[data-fit]");
  if (!el) return;
  const fit = () => {
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && size > 24) el.style.fontSize = (size -= 2) + "px";
  };
  document.fonts.ready.then(fit);
  addEventListener("resize", fit);
})();
