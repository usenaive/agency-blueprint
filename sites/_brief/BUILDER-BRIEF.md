# Builder brief: one pre-made agency website

You are building ONE of five pre-made websites for one agency type (recruiting, security-testing,
market-research, paid-ads, seo-geo or general). A company that activates
its plan gets one of the five, filled with its own name and setup answers by plain string
replacement. Your design must therefore look finished and intentional for ANY company's values,
not just the sample.

## Read first (all of it, it is short)
- <repo>/sites/README.md  (the format and the rules)
- <repo>/sites/placeholders.json (the ONLY allowed placeholder keys and max lengths)
- <repo>/sites/fill.ts, sites/sites.test.ts, sites/preview.ts
- The design method, the /awwwards skill (MIT, juliobsz/skills), at
  SK=<your clone of https://github.com/juliobsz/skills>/awwwards
  Read $SK/SKILL.md, then references/quality-bar.md, art-direction.md, typography.md, layout.md,
  content.md, quality.md, and the micro-interaction + hover sections of motion.md. Follow its
  process (concept card, art-direction system, build, QA) by hand, adapted to the constraints below.
  Its Next.js/Astro/GSAP/Lenis/WebGL stack does NOT apply here.

## Hard constraints (the format; the test enforces most of them)
- Your folder only: <repo>/sites/<agency-type>/<your folder>/ . Touch nothing else.
- Files: index.html, 404.html, assets/ (site.css, site.js, favicon.svg), manifest.json, sample.json.
  Plain static HTML/CSS/vanilla JS. No build step, no npm packages, no frameworks, no CDN scripts.
- No runtime network request at all. Design with Google Fonts links while you work, then run
  `node --experimental-strip-types sites/selfhost-fonts.ts <your folder>` to swap them for
  woff2 files in assets/. No trackers, no images from the web, no stock photos, no JSON-LD schema.org URLs. Inline SVG `xmlns="http://www.w3.org/2000/svg"` is fine.
  No http(s) URL of any other host may appear anywhere in your html/css/js/svg (the test greps).
- Placeholders: `{{key}}` with no spaces, keys only from placeholders.json, only inside .html files.
  Use them for all company-specific copy: <title>, meta description, og:title/og:description,
  header wordmark, hero, services (all 4), specialties (use all 6), process (all 3), audience,
  pricing_note, contact_email (mailto link + visible), city, footer © {{year}} {{company_name}}.
  Design-level copy that is true for any agency of this type (section labels, CTA labels like
  "Send us a role", short connective lines) is written directly in the HTML; keep it generic
  enough to be true for every agency of this type, specific enough to have voice.
- No invented proof in the template's own copy: no client logos, testimonials, case studies,
  counts, rates, awards, or "guarantee". No vendor/platform names. Proof comes only from the
  optional `proof[]` (up to 3: text + optional source) and `logos[]` (up to 6 names) keys:
  design a section for each in your concept, wrapped in `{{#if proof}}…{{/if}}` /
  `{{#if logos}}…{{/if}}`, with each item in `{{#if proof[i]}}` and each source in
  `{{#if proof[i].source}}` (see sites/README.md). The page must look complete without them.
- `404.html`: designed in the same system, inline CSS, `/assets/...` paths, link home to `/`.
- `<!--host-head-->` inside every `<head>` (the host injects canonical, og:image, twitter:card).
- No smooth scrolling (CSS or JS). Scroll-revealed content must look finished un-revealed.
- Copy rules from content.md: sentence case, no em or en dashes in visible text, none of the
  banned words (elevate, seamless, unleash, cutting-edge, passionate, ...).
- Accessibility: lang, one h1, header/main/footer landmarks, a skip link first in tab order,
  visible focus styles in the system's accent, AA contrast (4.5:1 text, 3:1 large), real links
  and buttons, decorative duplicates aria-hidden, `prefers-reduced-motion: reduce` shows all
  content fully with no movement.
- Phone: compose for 390 px wide (re-tuned type scale, no horizontal overflow, tap targets >= 24 px,
  the signature moment adapted not removed). Desktop: 1440.
- Theme: as given in your concept (one deliberate theme, or both light and dark via
  prefers-color-scheme, both designed).
- Robust to content length: every field can be anywhere up to its maxLength. Test with
  sites/_brief/long.json
  (everything at max length) and make sure nothing overflows, overlaps or breaks. Long words
  (a 38-character company name) must wrap or scale, never overflow at 390 px.
- Motion: vanilla JS/CSS only, small. One signature moment tied to the concept, primary hovers
  that move (not color-only), something of the concept alive at rest if it fits, IntersectionObserver
  reveals only where they carry the motion verb. Content must be visible without JS
  (progressive enhancement: hide-for-reveal only after JS adds a class to <html>).
- Size: keep the whole page well under 200 KB excluding fonts. At most 2 font families (3 only if
  the third is a tiny accent). Load fonts with display=swap and preconnect.
- A favicon (assets/favicon.svg) that matches the identity, using no placeholder.

## sample.json
Every required key in placeholders.json, exactly the list lengths, within max lengths, plus
sample `proof` and `logos` marked "(sample)" in each source. Realistic, specific
copy for the fictional sample agency named in your concept. Write as the agency owner would. The
pricing_note can name a realistic fee model (e.g. "A percentage of first-year base salary, invoiced
when your hire starts"). No result claims.

## manifest.json
{
  "id": "<agency-type>/<folder>", "agencyType": "<agency-type>", "design": "<Name>",
  "style": "<one line: the look and the idea>", "theme": "light|dark|both",
  "fonts": [..], "concept": { "idea": "", "signature": "", "motionVerb": "", "palette": { role: hex } },
  "placeholders": [ every key your HTML uses, exactly ],
  "jury": { "critic": { "design": 1, "usability": 1, "creativity": 1, "content": 1, "overall": 1 }, "estimate": 0, "independent": true, "date": "pending" }
}
(The jury block is a stub; the lead fills it after a blind critic scores your site.)

## Verify (loop until clean)
cd <repo>
- `pnpm exec vitest run sites/` (your site's tests must pass except the jury stub is fine as is; it is >= 1)
- `node --experimental-strip-types --no-warnings sites/preview.ts sites/<agency-type>/<folder> --full`
  writes preview-desktop.png / preview-phone.png in your folder and full-page shots into the temp
  dir it prints (full-desktop.png, full-phone.png). Add `--dark` for the dark scheme if you do both
  (that writes *-dark.png previews; delete those from your folder afterwards, keep only the two
  light previews unless your theme is dark-only).
- To check long content: fill with long.json into a temp dir with fill.ts and screenshot it the
  same way (copy the folder to a temp dir, replace sample.json with long.json, run preview.ts on
  the copy).
- LOOK at every screenshot with the Read tool (desktop + phone, first frame and full page) and fix
  what looks wrong: overflow, collisions, weak hierarchy, cramped phone layout, empty areas, contrast.
- Optional but recommended: accessibility and overflow measurement with the skill's shoot script
  (install Playwright + axe once in ~/.cache/jury, as /jury describes):
  fill into a temp dir, then
  `cd ~/.cache/jury && (node $SK/scripts/serve.mjs <filled dir> --port <unique port> &) && node $SK/scripts/shoot.mjs http://127.0.0.1:<port>/ --out <tmp>/shots --hovers 6`
  and read report.json for axe violations, overflow, smallTargets, keyboard focus. Kill the server after.

Do not commit, push, or touch git. At most two builders run at once. Do not create any other files in the repo.

## Report back
The concept card (idea, signature, motion verb, palette, type), the three concepts you considered
and why you picked this one (one line each), what you checked and fixed, and anything you could
not solve.
