# Studio theme: the public site for `advertising` agencies

The `advertising` template's public site, picked in `site/src/main.tsx`; same `site_profile` as every
theme. Built with the `/awwwards` skill's method. Demo agency: Halfmoon Studio (fictional).

## Brief

- **Subject:** a creative studio that makes ads (briefs, concepts, copy, statics, video spots) and
  never buys media.
- **Audience:** brand and marketing leads who run their own media and need the creative.
- **Job:** brief the studio on a campaign (the contact form posts a CRM lead).

## Concepts

| | Idea | Anchor | Signature | O/F/Fe/P |
|---|---|---|---|---|
| A. Material | **Every frame is a placement.** The hero is one ad, re-cropped live through the placements it must run in, with crop marks and its real spec | the studio's deliverable is "static ads in every placement size"; one idea has to survive every crop | scroll re-crops a flat field around the headline: 1:1, 4:5, 9:16, 1.91:1, each labelled with its pixel size | 4 / 5 / 4 / 2 |
| B. Name | Halfmoon: a disc waxes from new to full as you scroll | the demo agency's name | the moon phase follows scroll | 3 / 3 / 5 / 4 |
| C. Process | Three concepts, one chosen: every section offers three and you keep one | the studio pitches three concepts | pick one of three | 3 / 4 / 3 / 3 |

**Pick A.** It is about the work itself, the labels are real placement specs, and it reads in one
frame. B is decoration on a name; C turns the site into a quiz. From B: the wordmark carries a half
disc.

## Concept card

```
Idea:        One ad, re-cropped through every placement it has to run in.
Metaphor:    a production artboard: a flat field, crop marks, a spec line
Signature:   the hero frame at 4:5 with crop marks; the reader picks 1:1, 4:5, 9:16 or 1.91:1 to re-crop it
Emotion:     confident, bold, made by people who ship ads
Motion verb: re-crop: one click, the frame resizes, the content holds still
Screenshot:  the headline with the yellow 9:16 frame cutting through it, crop marks and "1080 × 1920"
```

## System

- **Palette** (from the profile): `ground` #fafaf7, `ink` #0e0e0e, `muted` #5b5b57, `accent` field
  yellow #f5c400 (the ad field, the contact band, button fill on hover), `accentInk` = ink.
- **Type:** Archivo Variable. Display at width 125 and weight 800 (the shout of a poster); text at
  width 100 and weight 400. JetBrains Mono only for specs (pixel sizes, ratios, scene numbers).
- **Layout:** sections are artboards: services hang as frames of different ratios with crop marks;
  process is a storyboard strip of 16:9 panels; the brief form sits on the yellow field.
- **Shape:** square; crop marks, not borders; no shadows.
- **Motion:** native scroll; nothing pins, scrubs or moves on its own. The hero frame opens at 4:5 and
  re-crops only when the reader picks a placement (0.4 s resize; the field is sized in CSS from
  container units, no script). Hovers 0.4 s at most. Reduced motion: no transitions at all.

## QA log

- **Build fixes before review:** the hero field and the form's labels shared a class (`a-field`), so
  every label rendered as a yellow block over the hero; the field is now `a-adfield`. The timeline's
  trigger looked for `[data-hero]` inside the hero instead of the hero itself, so the re-crop only ran
  to 4:5; it now spans all four placements. Footer wordmark sized from the name's length.
- **Pass 1** (fresh critic, evidence only): 6.2. Fixed after it: the hero's secondary link keeps a
  paper backing over the frame; phone cards fit their words (the ratio stays in the label); lists
  follow the text instead of sinking to the card's foot.
- **2026-11-01, calm pass** (owner: "difficult to scroll and too flashy"): the hero was a 330svh sticky stage scrubbed by
  GSAP, so one 800 px wheel moved `scrollY` 800 but the headline 0 px for three screens; it is now one
  viewport tall and the headline moves 800 px with the wheel. `frames.ts` and the timeline are gone; the
  placement chips are buttons. The lede is capped at 46ch and four lines.
- **Open, and the biggest gain:** the frame re-crops nothing. A real sample ad inside it (headline,
  product, logo), re-laid out per placement, is what turns the signature into proof; it needs real
  imagery, so it waits for assets. Mobile LCP about 2.6 s.
