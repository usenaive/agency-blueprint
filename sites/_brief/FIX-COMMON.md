# Fix pass (blind jury round 1): common items for every site

A blind critic scored every site 7/7/7/7 (overall 7.00 on its strict scale). Do the common
fixes below plus the site-specific ones in your message, then re-run tests and previews and
look at them. Stay in your own folder. No git.

1. Add a designed `404.html` in your folder (the test now requires it). Same fonts, palette,
   header and footer as index.html, the concept carried into it (one small idea, e.g. the
   site's signature element in an "empty" state), `lang`, a `<title>` with {{company_name}},
   one h1, and a clear link home. The host serves 404.html at whatever path was requested, so
   inline the 404's CSS in the file, reference the favicon as `/assets/favicon.svg`, and link
   home with `href="/"`. No JS needed. Use only vocabulary
   placeholders, and add any new ones to manifest.placeholders.
2. Meta: keep the meta description under ~160 characters of fixed text plus placeholders
   (prefer `{{tagline}}` alone or a short fixed lead + {{city}}); keep `<title>` short
   (`{{company_name}} | Recruiting` style).
3. Contrast: any grey text flagged for review must be >= 4.5:1 on its ground; darken if close.
4. Every primary link/button hover must move or fill, not only change color, including the
   wordmark/logo link, "back to top" style links and secondary CTAs.
5. Do NOT add proof (placements, numbers, testimonials, fee figures): the critic asked for it,
   but invented proof is banned by the format. Do NOT add og:image (it needs an absolute URL
   on an unknown host); canonical/robots/sitemap are the host's job.
6. Re-run `pnpm exec vitest run sites/` (other builders are editing in parallel; if another
   site's test fails, ignore it), regenerate previews with sites/preview.ts, and Read them.

Report back in under 150 words: what you changed.
