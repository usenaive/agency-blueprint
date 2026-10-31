/**
 * The studio theme's one moving system (DESIGN.md): the hero's field is re-cropped through real ad
 * placements as the pinned hero scrolls. Only `clip-path` and transforms move. GSAP's ScrollTrigger is
 * the only clock; under reduced motion the field holds at 4:5 and nothing pins.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Real placement sizes, in the order the frame visits them. */
export const PLACEMENTS = [
  { ratio: 1, label: "1:1", size: "1080 × 1080", use: "feed, square" },
  { ratio: 4 / 5, label: "4:5", size: "1080 × 1350", use: "feed, portrait" },
  { ratio: 9 / 16, label: "9:16", size: "1080 × 1920", use: "stories and reels" },
  { ratio: 1200 / 628, label: "1.91:1", size: "1200 × 628", use: "link ads" },
] as const;

/** The largest box of `ratio` that fits 86% × 80% of the stage, centred. */
function box(stage: DOMRect, ratio: number) {
  const maxW = stage.width * 0.86;
  const maxH = stage.height * 0.8;
  const w = Math.min(maxW, maxH * ratio);
  const h = w / ratio;
  return { x: (stage.width - w) / 2, y: (stage.height - h) / 2, w, h };
}

export function startFrames(root: HTMLElement, onPlacement: (index: number) => void): () => void {
  const stage = root.querySelector<HTMLElement>("[data-stage]");
  const field = root.querySelector<HTMLElement>("[data-field]");
  const marks = [...root.querySelectorAll<HTMLElement>("[data-corner]")];
  if (!stage || !field) return () => {};
  const place = (i: number) => {
    const s = stage.getBoundingClientRect();
    const b = box(s, PLACEMENTS[i]!.ratio);
    return {
      clip: `inset(${b.y}px ${s.width - b.x - b.w}px ${s.height - b.y - b.h}px ${b.x}px)`,
      corners: [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]] as [number, number][],
    };
  };
  const set = (i: number) => {
    const p = place(i);
    gsap.set(field, { clipPath: p.clip });
    marks.forEach((m, k) => gsap.set(m, { x: p.corners[k]![0], y: p.corners[k]![1] }));
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    set(1);
    onPlacement(1);
    const still = () => set(1);
    addEventListener("resize", still);
    return () => removeEventListener("resize", still);
  }
  gsap.registerPlugin(ScrollTrigger);
  const ctx = gsap.context(() => {
    set(0);
    const tl = gsap.timeline({
      defaults: { ease: "power3.inOut", duration: 1 },
      scrollTrigger: {
        trigger: root, // the pinned hero itself: progress runs over its own scroll room
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => onPlacement(Math.min(PLACEMENTS.length - 1, Math.round(self.progress * (PLACEMENTS.length - 1)))),
      },
    });
    for (let i = 1; i < PLACEMENTS.length; i++) {
      tl.to(field, { clipPath: () => place(i).clip }, i - 1);
      marks.forEach((m, k) => tl.to(m, { x: () => place(i).corners[k]![0], y: () => place(i).corners[k]![1] }, i - 1));
    }
  }, root);
  onPlacement(0);
  return () => ctx.revert();
}
