# Pre-made agency sites

Thirty finished websites, built once: five designs for each of six agency types (`recruiting`,
`security-testing`, `market-research`, `paid-ads`, `seo-geo`, `general`). When a company
activates its plan it gets one of its type's five, filled with its own name and setup answers.
There is no per-company design work. The first fill waits for the owner's approval (preview,
then Publish), and the Marketing agent edits the copy from there.

## Layout

```
sites/
  placeholders.json        the one fill vocabulary, shared by all 30 sites
  defaults.json            per agency type, the copy used where the company gave none
  fill.ts                  the fill: plain string replacement, no model
  preview.ts               fill with sample.json, then screenshot desktop + phone
  selfhost-fonts.ts        swap a Google Fonts <link> for woff2 files in assets/
  _brief/                  the builder brief, the fix-pass brief and max-length test values
  sites.test.ts            the format, checked for every site
  <agency-type>/<n>-<slug>/
    index.html             the page; CSS and JS inline or in assets/
    404.html               a designed not-found page in the same system
    assets/                site.css, site.js, favicon.svg, fonts.css + fonts/ (self-hosted woff2)
    manifest.json          what the site is (below); not served
    sample.json            realistic values, so the site can be previewed filled; not served
    preview-desktop.png    1440x900, filled with sample.json; not served
    preview-phone.png      390x844; not served
```

Each site is a self-contained static site with no build step: fill it, then serve the folder
as-is from the free-site host.

## The contact form

`form.html` is the one contact form every design carries, copied verbatim into its `index.html`
next to the email links (`sites.test.ts` checks every copy). It sits inside `{{#if form_action}}`:
the platform fills `form_action` with the live site's own form address, and posts land in the
company's CRM as a contact at `talking` with the visitor's message on their timeline. With no
address the block is removed and the `mailto:` links stay. It needs no script: it posts as a plain
form, and the platform sends the browser back to `#contact-sent` or `#contact-failed` (which
offers the email link). Change the block in `form.html`, then replace every copy.

The email is optional too: the platform fills `contact_email` with `""` until the owner chooses
to show one. Every email link and sentence sits inside `{{#if contact_email}}`, and a button
outside the contact section goes to that section (`#contact`, or the design's own id) instead of
`mailto:`, so it works either way.

## Placeholders

`{{key}}`, with no spaces. Keys come only from `placeholders.json`:

| Key | From |
|---|---|
| `{{company_name}}`, `{{tagline}}`, `{{intro}}` | the agency name and the `about` setup answer |
| `{{audience}}` | the `markets` answer: locations, levels, industries |
| `{{pricing_note}}` | the `offer` answer: how it charges, in its own words |
| `{{city}}`, `{{contact_email}}`, `{{year}}`, `{{form_action}}` | the company record (`city` and `contact_email` only when the company gave them: always inside their own `{{#if}}`) |
| `{{services[0].title}}`, `{{services[0].description}}` … `[3]` | four offers |
| `{{specialties[0]}}` … `[5]` | six short labels (roles, channels, disciplines) |
| `{{process[0].title}}`, `{{process[0].description}}` … `[2]` | three steps |

Optional, company-supplied proof (never invented, never in a template's own copy):

| Key | Holds |
|---|---|
| `{{proof[0].text}}`, `{{proof[0].source}}` … `[2]` | up to three results, quotes or facts, with an optional source |
| `{{logos[0]}}` … `[5]` | up to six client names, set as text |

Every optional placeholder sits inside a block for itself, which the fill removes when the value
is empty or absent, so a company with no proof gets a page with no proof section at all:

```html
{{#if proof}}<section>…
  {{#if proof[0]}}<blockquote>{{proof[0].text}}{{#if proof[0].source}}<cite>{{proof[0].source}}</cite>{{/if}}</blockquote>{{/if}}
…</section>{{/if}}
```

Lists have a fixed length, so one values object fills any of the 30 designs. A site may use a
subset of the keys; its manifest lists exactly the ones it uses. Placeholders appear only in
`.html` files. The fill HTML-escapes every value.

```bash
node --experimental-strip-types sites/fill.ts sites/recruiting/1-brief /tmp/out values.json
node --experimental-strip-types sites/preview.ts sites/recruiting/1-brief   # writes the two previews
```

## defaults.json and the platform

`defaults.json` holds, per agency type, every required value except the four the platform takes
from the company (`company_name`, `city`, `contact_email`, `year`): copy true for any agency of
that type, never a claim about a client. At activation the platform fills the chosen design from
these defaults, with `intro`, `audience` and `pricing_note` replaced by the owner's setup answers
(`about`, `markets`, `offer`) when it has them. No model writes the copy.

The platform publishes this folder from a tag with
`node scripts/publish-artifacts.mjs --sites --tag=vX.Y.Z --env=<env>` (vetta-mono): one tree per
design, without the files that are not served, and an index naming every design with these
defaults.

## Host head marker

Every page has `<!--host-head-->` in its `<head>`. At publish the host replaces it with what
needs the live URL: canonical, `og:image`/`twitter:card`, and it serves `robots.txt` and
`sitemap.xml` itself. Sites ship none of these.

## manifest.json

```json
{
  "id": "recruiting/1-brief",
  "agencyType": "recruiting",
  "design": "Brief",
  "style": "One line on the look and the idea.",
  "theme": "light | dark | both",
  "fonts": ["Newsreader", "Hanken Grotesk"],
  "concept": { "idea": "…", "signature": "…", "motionVerb": "…", "palette": { "ground": "#…", "ink": "#…" } },
  "placeholders": ["company_name", "services[0].title", "..."],
  "jury": { "critic": { "design": 7, "usability": 7, "creativity": 7, "content": 7, "overall": 7 }, "estimate": 8.1, "independent": true, "date": "2026-11-15" }
}
```

`concept` is the /awwwards concept card, kept so later copy edits stay inside the design.
`jury` is the /jury score. `independent: true` means a fresh critic that saw only screenshots
and measurements; `false` marks a self-score (the recruiting batch's round 2, after a blind
round 1 kept in `blindRound1`).
`estimate` is the critic's overall plus the /jury calibration offset (1.1), an estimate only and
not affiliated with Awwwards.

## Rules every site follows

- No network request at runtime: fonts are self-hosted woff2 (`selfhost-fonts.ts`, OFL fonts
  with a licence note in `assets/fonts/`). No trackers, no analytics, no CDN scripts.
- A designed `404.html` in the site's own system, with inline CSS, root-absolute asset paths
  and a link to `/`.
- No smooth scrolling (it breaks keyboard focus landing). Content revealed on scroll must look
  finished in its un-revealed state too, because full-page captures and crawlers see it that way.
- No invented proof: no client logos, testimonials, case studies or result numbers in a
  template's own copy. Those are claims about real people, so only `proof[]` and `logos[]`
  carry them, filled by the company.
- Works at 390 px wide; one theme on purpose or both light and dark, as the manifest says.
- Accessible: one `h1`, landmarks, a skip link, visible focus, AA contrast, and full content
  with `prefers-reduced-motion`.
- No vendor or platform name anywhere a visitor can see.

## Design method

Designs follow the `/awwwards` skill and are scored with `/jury`, both from
[juliobsz/skills](https://github.com/juliobsz/skills) (MIT, Copyright (c) 2026 Julio). For
each site: a concept from the agency's own world, an art-direction system (palette, type,
grid, motion verb), a build in plain HTML/CSS/JS, then a blind critic score; any category
under 7 gets a fix pass.
