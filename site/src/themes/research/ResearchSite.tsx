/**
 * The `market-research` template's public site (DESIGN.md beside this file): a ruled field notebook
 * marked up in pen as it is read. Same `site_profile` as every theme; the pen writes only the page's
 * own words (entry numbers, the ground rules, Q and A).
 */
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/caveat";
import "./research.css";
import { useEffect, useRef, type ReactNode } from "react";
import type { SiteProfile } from "../../../site.config.ts";
import type { PublicPost } from "../../profile.ts";
import { useLeadForm } from "../useLeadForm.ts";
import { startMarks } from "./marks.ts";

/** One pen stroke, stretched to its box; the stroke keeps its width (`non-scaling-stroke`). */
const PATHS = {
  underline: { box: "0 0 100 12", d: ["M1 7 C 18 4, 34 9, 52 6 S 86 4, 99 7", "M6 11 C 30 8, 62 11, 95 9"] },
  circle: { box: "0 0 100 40", d: ["M10 24 C 4 10, 38 2, 68 3 C 95 4, 100 24, 82 34 C 62 42, 16 40, 7 29 C 2 22, 9 13, 24 9"] },
  tick: { box: "0 0 20 20", d: ["M2.5 11 L8 16.5 L18 3"] },
} as const;

function Mark({ kind, className = "" }: { kind: keyof typeof PATHS; className?: string }) {
  const { box, d } = PATHS[kind];
  return (
    <svg className={`r-mark r-mark--${kind} ${className}`} viewBox={box} preserveAspectRatio="none" aria-hidden="true">
      {d.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

/** A numbered notebook entry: the number in the margin in pen, the heading circled once it is read. */
function Entry({ id, n, title, sub, circled = false, children }: { id: string; n: number; title: string; sub?: string; circled?: boolean; children: ReactNode }) {
  return (
    <section id={id} className="r-entry" data-entry aria-labelledby={`r-${id}`}>
      <p className="r-num" aria-hidden="true">No. {n}</p>
      <div className="r-entry__body">
        <h2 id={`r-${id}`} className="r-h2">{circled ? <span className="r-circled">{title}<Mark kind="circle" /></span> : title}</h2>
        {sub ? <p className="r-sub">{sub}</p> : null}
        {children}
      </div>
    </section>
  );
}

function Ticked({ items }: { items: string[] }) {
  return (
    <ul className="r-ticks">
      {items.map((item, i) => <li key={item} style={{ ["--i" as string]: i }}><Mark kind="tick" />{item}</li>)}
    </ul>
  );
}

function Header({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  const nav = [["Services", "#services"], ...(posts.length ? [["Notes", "#insights"]] : []), ["Process", "#process"], ["Studies", "#pricing"], ["Questions", "#faq"]];
  const jump = useRef<HTMLDetailsElement>(null);
  return (
    <header className="r-head">
      <a className="r-mark-link r-pen" href="#top">{site.company}</a>
      <nav aria-label="Sections" className="r-nav">{nav.map(([label, href]) => <a key={href} className="r-pen" href={href}>{label}</a>)}</nav>
      <details className="r-jump" ref={jump}>
        <summary>Contents</summary>
        <nav aria-label="Sections">
          {[...nav, [site.hero.cta, "#contact"]].map(([label, href]) => <a key={href} href={href} onClick={() => jump.current?.removeAttribute("open")}>{label}</a>)}
        </nav>
      </details>
      <a className="r-btn r-btn--small" href="#contact"><span>{site.hero.cta}</span></a>
    </header>
  );
}

function Hero({ site }: { site: SiteProfile }) {
  return (
    <section className="r-hero" data-entry aria-labelledby="r-h1">
      <p className="r-num r-num--owner" aria-hidden="true">{site.company}</p>
      <div className="r-entry__body">
        <p className="r-eyebrow">{site.hero.eyebrow}</p>
        <h1 id="r-h1" className="r-display"><span className="r-underlined">{site.hero.title}<Mark kind="underline" /></span></h1>
        <p className="r-lede">{site.hero.subtitle}</p>
        <div className="r-actions">
          <a className="r-btn" href="#contact"><span>{site.hero.cta}</span></a>
          <a className="r-pen r-pen--strong" href="#process">{site.hero.secondaryCta}</a>
        </div>
      </div>
      <aside className="r-margin-notes" aria-label="Ground rules">
        {site.proof.facts.map((fact) => <p key={fact}>{fact}</p>)}
      </aside>
    </section>
  );
}

function Services({ site }: { site: SiteProfile }) {
  return (
    <Entry id="services" n={1} title="What we find out" circled>
      <div className="r-services">
        {site.services.map((s) => (
          <article key={s.name} aria-labelledby={`r-svc-${s.name}`}>
            <h3 id={`r-svc-${s.name}`} className="r-h3">{s.name}</h3>
            <p className="r-kicker">{s.headline}</p>
            <p>{s.description}</p>
            <Ticked items={s.deliverables} />
          </article>
        ))}
      </div>
    </Entry>
  );
}

function Insights({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  if (posts.length === 0) return null;
  return (
    <Entry id="insights" n={2} title="Field notes" sub={`Published by ${site.company} after review.`}>
      <ul className="r-posts">
        {posts.map((post) => (
          <li key={post.id}><a className="r-post" href={post.path}><span>{post.postedAt ?? post.scheduledFor}</span><b>{post.title}</b></a></li>
        ))}
      </ul>
    </Entry>
  );
}

function Who({ site, n }: { site: SiteProfile; n: number }) {
  const { title, subtitle, segments } = site.whoWeServe;
  return (
    <Entry id="who" n={n} title={title}>
      <p className="r-statement">{subtitle}</p>
      <dl className="r-segments">{segments.map((s) => <div key={s.name}><dt>{s.name}</dt><dd>{s.description}</dd></div>)}</dl>
    </Entry>
  );
}

function Process({ site, n }: { site: SiteProfile; n: number }) {
  const { title, subtitle, steps } = site.process;
  return (
    <Entry id="process" n={n} title={title} sub={subtitle}>
      <ol className="r-steps">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span className="r-steps__n" aria-hidden="true">{i + 1}.</span>
            <div><h3 className="r-h3">{step.title}</h3><p>{step.description}</p></div>
          </li>
        ))}
      </ol>
    </Entry>
  );
}

function Pricing({ site, n }: { site: SiteProfile; n: number }) {
  const { title, subtitle, tiers } = site.pricing;
  return (
    <Entry id="pricing" n={n} title={title} sub={subtitle}>
      <div className="r-tiers">
        {tiers.map((tier) => (
          <article key={tier.name} className={tier.featured ? "is-featured" : undefined} aria-labelledby={`r-tier-${tier.name}`}>
            <h3 id={`r-tier-${tier.name}`} className="r-h3">{tier.featured ? <span className="r-circled">{tier.name}<Mark kind="circle" /></span> : tier.name}</h3>
            <p className="r-tier__price">{tier.price}{tier.cadence ? ` ${tier.cadence}` : ""}</p>
            <p className="r-tier__blurb">{tier.blurb}</p>
            <Ticked items={tier.includes} />
            <a className={tier.featured ? "r-btn" : "r-pen r-pen--strong"} href="#contact" aria-label={`${site.hero.cta}: ${tier.name}`}><span>{site.hero.cta}</span></a>
          </article>
        ))}
      </div>
    </Entry>
  );
}

function Faq({ site, n }: { site: SiteProfile; n: number }) {
  return (
    <Entry id="faq" n={n} title={site.faq.title}>
      <dl className="r-faq">
        {site.faq.items.map((item) => (
          <div key={item.question}>
            <dt><span className="r-qa" aria-hidden="true">Q.</span>{item.question}</dt>
            <dd><span className="r-qa" aria-hidden="true">A.</span>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </Entry>
  );
}

function Contact({ site, n }: { site: SiteProfile; n: number }) {
  const { form, set, toggle, state, onSubmit } = useLeadForm();
  const field = (label: string, key: "company" | "website" | "name" | "email", extra: { type?: string; placeholder?: string; autoComplete?: string } = {}) => (
    <label className="r-field">
      <span>{label}</span>
      <input id={`r-${key}`} required value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <Entry id="contact" n={n} title={site.contact.title} sub={site.contact.subtitle} circled>
      {state === "sent" ? (
        <p role="status" className="r-sent">Received. We reply within one business day.</p>
      ) : (
        <form className="r-form" onSubmit={onSubmit}>
          {field("Company", "company", { autoComplete: "organization" })}
          {field("Website", "website", { placeholder: "example.com", autoComplete: "url" })}
          {field("Your name", "name", { autoComplete: "name" })}
          {field("Work email", "email", { type: "email", autoComplete: "email" })}
          <fieldset className="r-choices">
            <legend>What do you need?</legend>
            {site.services.map((s) => (
              <label key={s.name}><input type="checkbox" checked={form.services.includes(s.name)} onChange={() => toggle(s.name)} /><span>{s.name}</span></label>
            ))}
          </fieldset>
          <label className="r-field r-field--wide">
            <span>The decision you are trying to make</span>
            <textarea id="r-note" rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
          <div className="r-form__send">
            <button className="r-btn" type="submit" disabled={state === "sending"}><span>{state === "sending" ? "Sending" : site.hero.cta}</span></button>
            {state === "offline" ? <p role="status">{site.contact.offlineNote} <a className="r-inline" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p> : null}
          </div>
        </form>
      )}
    </Entry>
  );
}

function Footer({ site }: { site: SiteProfile }) {
  return (
    <footer className="r-foot">
      <p className="r-foot__name">{site.company}</p>
      <div className="r-foot__row">
        <span>{site.footer.note}</span>
        <a className="r-pen" href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
      </div>
    </footer>
  );
}

export default function ResearchSite({ site, blog = [] }: { site: SiteProfile; blog?: PublicPost[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => (root.current ? startMarks(root.current) : undefined), []);
  const after = blog.length ? 3 : 2; // entry numbers run on past the optional notes
  return (
    <div id="top" className="r-site" ref={root}>
      <a className="r-skip" href="#main">Skip to content</a>
      <Header site={site} posts={blog} />
      <main id="main" className="r-paper">
        <Hero site={site} />
        <Services site={site} />
        <Insights site={site} posts={blog} />
        <Who site={site} n={after} />
        <Process site={site} n={after + 1} />
        <Pricing site={site} n={after + 2} />
        <Faq site={site} n={after + 3} />
        <Contact site={site} n={after + 4} />
      </main>
      <Footer site={site} />
    </div>
  );
}
