/**
 * The search theme's one moving system (see DESIGN.md): the parse line. Every `[data-parse]` block
 * that crosses 40% of the viewport is marked parsed, and its machine reading appears; the fixed
 * label names the block under the line. Scroll is native and nothing is scrubbed: crossing the line
 * only flips a class (CSS fades the reading in, 0.4 s at most). Under reduced motion every block
 * renders parsed at once.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const LINE = "top 40%";

export function startParse(root: HTMLElement): () => void {
  const blocks = [...root.querySelectorAll<HTMLElement>("[data-parse]")];
  const parse = (block: HTMLElement) => block.classList.add("is-parsed");
  // Reduced motion: every block is read at once, but the readout still follows.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) blocks.forEach(parse);
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
  }, root);
  return () => ctx.revert();
}
