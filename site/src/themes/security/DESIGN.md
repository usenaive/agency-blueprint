# Security theme: the public site for `security` agencies

The `security` template's public site, picked in `site/src/main.tsx`. It renders the same
`site_profile` as every other theme, so the copy stays the operator's. Built with the `/awwwards`
skill's method. Demo agency: Gatehouse Security (fictional).

## Brief

- **Subject:** a product testing agency: browser agents use a client's live product as its
  customer would, then red-team its edges, and file every gap with steps to reproduce. (It started
  as a readiness agency; the template changed under it, and the concept still holds: the page tests
  itself, as the agency tests its clients' products.)
- **Audience:** a founder or engineering lead with a launch, a drop-off or a scare.
- **Job:** book a test (the contact form posts a CRM lead).
- **Rule the site must keep:** the agency tests only products whose owner hired it, with test accounts.

## Concepts

| | Idea | Anchor | Signature | O/F/Fe/P |
|---|---|---|---|---|
| A. Material | **The page checks itself.** On arrival a passive check runs against this very page, from the visitor's browser, and its real results lead the hero | the agency only checks verified domains, so the one domain it checks without asking is its own | the check console: each line resolves from the page's real response headers, pass or not set | 4 / 5 / 4 / 1 |
| B. Material | Redaction: copy outside "scope" is barred out and lifts as it enters the viewport | scoped engagements | redaction bars wipe off | 3 / 3 / 4 / 3 |
| C. Formal | The page is a findings report ordered by severity | reports are the deliverable | a severity rail | 3 / 4 / 5 / 3 |

**Pick A.** It shows the service honestly and nothing in it can be moved to another agency: the
results are this page's own headers, read the moment it loads. It also turns the authorization rule
into the pitch ("the only domain we check without asking is this one"). From C: services are drawn
as report sections, with their deliverables as a checklist.

## Concept card

```
Idea:        The page runs a passive security check on itself while you read the headline.
Metaphor:    an exposure report: outside (dark band, what anyone can see) and inside (paper, the work)
Signature:   the check console; seven lines resolve from this page's real response
Emotion:     calm, exact, nothing to hide
Motion verb: resolve: the result arrives and every line settles at once
Screenshot:  the condensed headline on the dark band beside the console showing its own results
```

## System

- **Palette** (from the profile): the dark band is `ink` (#0c0f12), paper is `ground` (#f1f2ef),
  `muted` #5d636b, `accent` amber #e8a33d (the check's progress, the CTA fill; never body text on
  paper). Status colors are semantic and separate: pass #2f8f5b, not set #c4553b, note `muted`.
- **Type:** Instrument Sans Variable for everything a person reads, display at width 82% and weight
  640 (condensed, like a report title); JetBrains Mono for check output only.
- **Layout:** two bands. The outside (dark): header, hero, console; the finale's form returns to
  dark, so the page opens and closes outside. The inside (paper): rules, services as report sections,
  audience, process, tiers, FAQ.
- **Shape:** square corners; 1 px rules; no cards, no shadows.
- **Motion:** native scroll. Console lines resolve together when the real result arrives (0.35 s
  fade from pending); CTA fill rises from the bottom (0.4 s). Nothing moves at rest: a security buyer
  reads, and the console has done its work once. Under reduced motion there are no transitions.
- **Honesty rules:** the console reports only what the browser actually received. A header that is
  missing says "not set". On plain http (local preview) HTTPS and HSTS read "local preview", never pass.

## Genericness test

A generic security site lands on a dark hero with a glowing shield, a padlock icon and green-on-black
terminal text. Changed: no icons or shield; the terminal is replaced by a real result that can come
back "not set"; the dark band is a structural "outside", not a mood; amber, not neon green.

## QA log

- **Pass 1** (fresh critic, evidence only): 7.0. Fixed after it: checklists use the console's `[ ]`
  vocabulary; the nav says "Engagements", matching the section; the audience statement runs wider;
  the doubled rule under the last service is gone; phone eyebrow and console status alignment;
  filled buttons get a dark inner ring on focus. Hover, `keyboard.stuck` and `invisibleFocus` flags were
  smooth-scroll artifacts, verified by hand (every `.g-btn` fills; Tab reaches every field).
- **2026-11-01, calm pass** (owner: "difficult to scroll and too flashy"): console lines no longer stagger in over 1.1 s
  (260 ms + 140 ms each); hovers capped at 0.4 s; `site.css` smooth scroll removed. Lede capped at
  44ch and four lines.
- **Owed, outside this theme:** server-rendered HTML, a real 404, og:image and favicon (see
  `themes/search/DESIGN.md`). The three response headers this check reads were added for every
  template (`server/index.ts`, `build-api.mjs`); CSP and framing are left for a policy of their own.
