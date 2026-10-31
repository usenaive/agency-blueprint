# Research theme: the public site for `market-research` agencies

The `market-research` template's public site, picked in `site/src/main.tsx`; same `site_profile` as
every theme. Built with the `/awwwards` skill's method. Demo agency: Fieldnote Research (fictional).

## Brief

- **Subject:** a research agency selling market sizing, competitor teardowns and customer insight,
  with every figure sourced.
- **Audience:** founders, strategy leads and investors with a decision to make.
- **Job:** scope a research question (the contact form posts a CRM lead).

## Concepts

| | Idea | Anchor | Signature | O/F/Fe/P |
|---|---|---|---|---|
| A. Name and material | **The field notebook.** Ruled paper, a red margin, numbered entries; the researcher's pen marks the page as you read it | the demo agency is called Fieldnote, and research is notes checked against sources | ballpoint marks draw themselves: the headline underlined, each entry's heading circled, each deliverable ticked | 4 / 5 / 4 / 2 |
| B. Formal | Every claim carries a footnote; the margin is the bibliography | sourcing is the product | footnote lines draw to their source | 4 / 4 / 3 / 3 |
| C. Process | Two methods converge: top-down and bottom-up lines meet at each section | market sizing | two lines converge | 3 / 3 / 3 / 3 |

**Pick A.** It makes the agency's habit visible: reading carefully and marking what was checked. B
needs real sources the site copy does not carry; it would invent footnotes. From B: the ground rules
are written in the margin as the researcher's own notes.

## Concept card

```
Idea:        The site is a researcher's field notebook, marked up in pen as you read it.
Metaphor:    a ruled notebook: blue rules, red margin, numbered entries, ballpoint ink
Signature:   pen marks draw as each entry reaches the reader: underline, circle, tick
Emotion:     careful, human, trustworthy; someone actually read this
Motion verb: draw, like a pen: one stroke, start to finish
Screenshot:  the hero headline on ruled paper with its hand-drawn underline and a margin note
```

## System

- **Palette** (from the profile): `ground` #fbfbf8 paper (cool white, not cream), `ink` #1b1f24,
  `muted` #586069, `accent` #2346a0 ballpoint blue (pen marks, handwriting, the CTA), plus the
  notebook's own `rule` (blue, 22%) and `margin` red #d1493f, which are part of the paper, not accents.
- **Type:** Newsreader Variable (optical sizes) for everything typeset; Caveat only for what the pen
  writes (margin notes, entry numbers, Q and A). No sans.
- **Grid:** a 7.5rem margin column left of the red line holds entry numbers and notes; content
  hangs from the line. Body leading equals the rule spacing (1.75rem).
- **Shape:** no radius, no cards; ink, rules and paper only.
- **Motion:** each mark is one SVG stroke drawn by its dash offset (0.9 s, ease out) when its entry
  crosses 75% of the viewport; ticks stagger 90 ms. Still at rest. Reduced motion: every mark drawn.

## Genericness test

The generic research site is a navy corporate page with stock charts, or cream paper with a serif and
a terracotta accent. Changed: cool white ruled paper, blue ballpoint instead of terracotta, and the
only "illustration" is the pen marking the actual copy.

## QA log

- **Pass 1** (fresh critic, evidence only): 6.85. Fixed after it: pen strokes measured on screen so
  stretched marks draw as one line; only two headings are circled, so the circle means something, and
  it starts clear of the first letter; the nav says "Studies"; phone: no repeated name, stacked
  checkboxes, the circle stays inside the margin. CTA hover flags verified by hand as artifacts.
- **Open:** mobile LCP about 2.7 s (the lede waits on the serif); type sits near, not on, the rules.
