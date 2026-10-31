# Search theme: the public site for `seo-geo` agencies

The `seo-geo` template's own public site. Other templates keep the default site
(`site/src/App.tsx`); `site/src/main.tsx` picks this one when the template is `seo-geo`. It renders
the same `site_profile` as the default, so every word stays editable through `update_site` and
approvals. Built with the `/awwwards` skill's method (concept, system, QA).

## Brief

- **Subject:** an SEO and answer-engine (GEO) agency, first install Founder Frame (founderframehq.com):
  technical SEO and AI-answer optimization for seed-to-Series B B2B SaaS.
- **Audience:** founders and one-or-two-person marketing teams at B2B SaaS companies.
- **Job:** request a free audit (the contact form posts a CRM lead).
- **Constraint:** all copy is the operator's `site_profile`; the theme invents no claim, number or client.

## Concepts

| | Idea | Anchor | Signature | O/F/Fe/P |
|---|---|---|---|---|
| A. Material | **Two readers.** Every block is read twice: once by you, once by the crawler and the assistant. A parse line runs across the reading position; what passes it shows its machine reading in the margin | the agency's whole job is making pages legible to machines, and this page emits real structured data (`ProfessionalService`, `FAQPage`) | the parse line: blocks crossing it reveal their real tag, schema type and answer length | 4 / 5 / 4 / 2 |
| B. Formal | Every section is an answer block: a question, a 40 to 60 word answer, a citation | GEO answer blocks are the deliverable | answers assemble from their citations | 3 / 4 / 5 / 3 |
| C. Process | The page is ranked as you scroll: the agency's result climbs from page two to the answer box | moving clients up the results | a position counter ticking upward | 3 / 3 / 4 / 3 |

**Pick A.** It shows the service instead of describing it, and every label it prints is true: the
tags are the page's own markup, the schema types are the JSON-LD `applySeo` writes, the word counts
are counted. C was dropped because a climbing position reads as a claimed result. From B: FAQ answers
carry their word count, the measure an answer block is written to.

## Concept card

```
Idea:        The page shows you what search engines and assistants read from it.
Metaphor:    a crawler's parse of the page: tags, schema types, answer lengths
Signature:   the parse line at 40% of the viewport; each block that crosses it is marked parsed
             and its machine reading appears in the left margin, in mono
Emotion:     calm precision; "these people can see what Google sees"
Motion verb: sweep, like a scan line (left to right, top to bottom)
Screenshot:  the hero headline with its annotations in the margin and the answer card beside it
```

## System

- **Palette** (from the profile, so `update_site` still recolors it): `ground` #fbfaf8 paper,
  `ink` #111114, `muted` #63605a, `accent` #1d4ed8 (the machine's voice: annotations, the parse
  line, the one filled button), derived `line` (ink 12%) and `trace` (accent 7% on ground, the
  parsed highlight).
- **Type:** Host Grotesk Variable for everything a person reads (display 650, tracking -0.045em at
  mega size, leading 0.92); JetBrains Mono Variable only for what a machine reads (12 to 13 px).
  Two voices for the two readers.
- **Grid:** 12 columns, gutter 24 px (16 on phones). Columns 1 to 2 are the machine margin; human
  content hangs from column 3. On phones the margin folds into a mono line above each block.
- **Shape:** radius 2 px on controls only; no cards, no shadows.
- **Motion:** one ease (`expo.out`), hovers 0.35 s, the hero sweep 1.1 s. Motion is transform,
  opacity and clip-path only.
- **Sections, one family each:** hero = split frame (statement left, answer card right); proof =
  facts row; services = index list; who we serve = statement; process = timeline whose rule fills
  as it is parsed; insights = index list (only when posts exist); pricing = comparison table;
  FAQ = answer blocks with word counts; contact = footer finale with the wordmark.
- **Idle:** the parse line's caret blinks; everything else holds still at rest. This is a reading
  page for a B2B buyer, so the hovers and the parse carry the life.
- **Reduced motion:** no sweep; every block renders parsed, annotations visible.
- **No smooth-scroll library:** native scroll is the better usability choice for a sales page;
  GSAP's ScrollTrigger is the one clock for the parse.

## Genericness test

The default site (centered hero, three equal cards per section, an eyebrow over every heading)
was exactly what a generic model produces. Changed: left-hung statement hero, no cards anywhere,
section labels replaced by the machine margin, which carries real information.

## QA log

- **Pass 1** (fresh critic, evidence only): 6.6. Fixed in this theme: pricing rebuilt as tier columns
  that stack at phone width, with the tier name as the headline instead of three identical "Custom"
  prices; margin labels always present (dim until parsed, so the concept never looks absent); the
  readout holds the last block parsed and still follows the page under reduced motion; the panel
  shows the hostname without a port; process steps set at display size; anchors and focus stop below
  the sticky header; footer email is a full tap target; the theme chunk downloads beside `/api/site`.
- **Measurement artifacts, verified by hand:** `noHoverChange` on two CTAs, `keyboard.stuck` and
  `invisibleFocus` come from smooth scrolling (`site.css`) while the checker measures; with instant
  scroll every `.s-btn` fill sweeps and Tab reaches every form field.
- **Outside this theme, owed:**
  1. The public site is rendered by JavaScript, so the first response has no `<h1>`, `<main>` or text
     (audit FAIL). Crawlers that do not run JavaScript, including many AI crawlers, see an empty page.
     `server/public-site.ts` already writes the head; the body needs server rendering too. Applies to
     every template.
  2. Any unknown path answers 200 with the home page; a real 404 needs a status and a page.
  3. No `og:image` or favicon in the shell.
  4. Founder Frame's own copy: the description is 195 characters (search shows about 155), and
     "operator" in public copy is internal vocabulary.
