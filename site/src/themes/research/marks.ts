/**
 * The research theme's one moving system (DESIGN.md): pen marks. Every `[data-entry]` that reaches
 * 75% of the viewport is marked drawn, and its SVG strokes draw themselves through CSS. GSAP's
 * ScrollTrigger is the only clock; under reduced motion every entry is drawn at once.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * A stretched stroke keeps its width (`non-scaling-stroke`), so its dashes are measured on screen,
 * not in the SVG's units. Measure each path's drawn length there and hand it to CSS as `--len`.
 */
function measure(root: HTMLElement) {
  for (const path of root.querySelectorAll<SVGPathElement>(".r-mark path")) {
    const ctm = path.getScreenCTM();
    if (!ctm) continue;
    const total = path.getTotalLength();
    let length = 0;
    let last: DOMPoint | null = null;
    for (let i = 0; i <= 40; i++) {
      const p = path.getPointAtLength((total * i) / 40).matrixTransform(ctm);
      if (last) length += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
    }
    path.style.setProperty("--len", `${Math.ceil(length) + 2}px`);
  }
}

export function startMarks(root: HTMLElement): () => void {
  const remeasure = () => measure(root);
  remeasure();
  void document.fonts?.ready.then(remeasure); // the type's final metrics move every mark
  addEventListener("resize", remeasure);
  const entries = [...root.querySelectorAll<HTMLElement>("[data-entry]")];
  const draw = (entry: HTMLElement) => entry.classList.add("is-drawn");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    entries.forEach(draw);
    return () => removeEventListener("resize", remeasure);
  }
  gsap.registerPlugin(ScrollTrigger);
  const ctx = gsap.context(() => {
    for (const entry of entries) ScrollTrigger.create({ trigger: entry, start: "top 75%", once: true, onEnter: () => draw(entry) });
  }, root);
  return () => {
    removeEventListener("resize", remeasure);
    ctx.revert();
  };
}
