/**
 * The search theme's one moving system (see DESIGN.md): the parse line. Every `[data-parse]` block
 * that crosses 40% of the viewport is marked parsed, and its machine reading appears; the fixed
 * label names the block under the line; the process rule fills as it is read. The hero is swept
 * once on arrival. GSAP's ticker is the only clock, and under reduced motion nothing moves: every
 * block renders parsed at once.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const LINE = "top 40%";

export function startParse(root: HTMLElement): () => void {
  const blocks = [...root.querySelectorAll<HTMLElement>("[data-parse]")];
  const parse = (block: HTMLElement) => block.classList.add("is-parsed");
  // Reduced motion: every block is read at once and nothing sweeps, but the readout still follows.
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) blocks.forEach(parse);
  gsap.registerPlugin(ScrollTrigger);
  const now = document.querySelector<HTMLElement>("[data-parse-now]");
  const ctx = gsap.context(() => {
    // The readout names the last block whose top crossed the line, so it never goes stale between blocks.
    const name = (block?: HTMLElement) => { if (now) now.textContent = block?.dataset.parse ?? "hero"; };
    blocks.forEach((block, i) => {
      ScrollTrigger.create({
        trigger: block,
        start: LINE,
        onEnter: () => { parse(block); name(block); },
        onLeaveBack: () => name(blocks[i - 1]),
      });
    });
    // A block already above the line (a deep link, a reload mid-page) was read before we arrived.
    const line = innerHeight * 0.4;
    for (const block of blocks) if (block.getBoundingClientRect().top < line) parse(block);

    if (still) return;
    const sweep = root.querySelector<HTMLElement>("[data-sweep]");
    const hero = sweep?.parentElement;
    if (sweep && hero) {
      gsap.fromTo(sweep, { y: 0, autoAlpha: 1 }, { y: hero.offsetHeight, duration: 1.1, ease: "expo.out", delay: 0.15 });
      gsap.to(sweep, { autoAlpha: 0, duration: 0.3, delay: 1.2 });
    }
    gsap.fromTo("[data-rule]", { scaleX: 0 }, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: { trigger: "[data-rule]", start: "top 75%", end: "top 25%", scrub: true },
    });
  }, root);
  return () => ctx.revert();
}
