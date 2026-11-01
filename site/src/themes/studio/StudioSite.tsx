/**
 * The `advertising` template's public site (DESIGN.md beside this file): one ad, re-cropped through
 * every placement it has to run in. Same `site_profile` as every theme; the specs it prints are real
 * placement sizes.
 */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "./studio.css";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SiteProfile } from "../../../site.config.ts";
import type { PublicPost } from "../../profile.ts";
import { useLeadForm } from "../useLeadForm.ts";

/** Real placement sizes; the hero's frame shows one at a time, picked by the reader. */
const PLACEMENTS = [
  { ratio: 1, label: "1:1", size: "1080 × 1080", use: "feed, square" },
  { ratio: 4 / 5, label: "4:5", size: "1080 × 1350", use: "feed, portrait" },
  { ratio: 9 / 16, label: "9:16", size: "1080 × 1920", use: "stories and reels" },
  { ratio: 1200 / 628, label: "1.91:1", size: "1200 × 628", use: "link ads" },
] as const;

function Arrow() {
  return <svg className="a-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

/** Four crop marks around whatever frame holds them. */
function Crops() {
  return <>{["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`a-crop a-crop--${c}`} aria-hidden="true" />)}</>;
}

/** A section's artboard: a frame of one placement ratio, with its crop marks and spec line. */
function Board({ ratio, spec, children, className = "" }: { ratio: string; spec: string; children: ReactNode; className?: string }) {
  return (
    <div className={`a-board ${className}`} style={{ aspectRatio: ratio }}>
      <Crops />
      <span className="a-spec" aria-hidden="true">{spec}</span>
      <div className="a-board__in">{children}</div>
    </div>
  );
}

function Header({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  const nav = [["Services", "#services"], ...(posts.length ? [["Notes", "#insights"]] : []), ["Process", "#process"], ["Pricing", "#pricing"], ["FAQ", "#faq"]];
  const jump = useRef<HTMLDetailsElement>(null);
  return (
    <header className="a-head">
      <a className="a-mark" href="#top"><span className="a-mark__moon" aria-hidden="true" />{site.company}</a>
      <nav aria-label="Sections" className="a-nav">{nav.map(([label, href]) => <a key={href} className="a-draw" href={href}>{label}</a>)}</nav>
      <details className="a-jump" ref={jump}>
        <summary>Sections</summary>
        <nav aria-label="Sections">
          {[...nav, [site.hero.cta, "#contact"]].map(([label, href]) => <a key={href} href={href} onClick={() => jump.current?.removeAttribute("open")}>{label}</a>)}
        </nav>
      </details>
      <a className="a-btn a-btn--small" href="#contact"><span>{site.hero.cta}</span></a>
    </header>
  );
}

function Hero({ site }: { site: SiteProfile }) {
  const [at, setAt] = useState(1);
  const p = PLACEMENTS[at]!;
  return (
    <section className="a-hero" aria-labelledby="a-h1">
      <div className="a-stage">
        <span className="a-adfield" style={{ "--r": p.ratio } as CSSProperties} aria-hidden="true">
          {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`a-corner a-corner--${c}`} />)}
        </span>
        <div className="a-hero__copy">
          <p className="a-kicker">{site.hero.eyebrow}</p>
          <h1 id="a-h1" className="a-display">{site.hero.title}</h1>
          <p className="a-lede">{site.hero.subtitle}</p>
          <div className="a-actions">
            <a className="a-btn" href="#contact"><span>{site.hero.cta}</span><Arrow /></a>
            <a className="a-link" href="#process">{site.hero.secondaryCta}</a>
          </div>
        </div>
        <p className="a-readout">
          <b>{p.label}</b><span>{p.size}</span><span>{p.use}</span>
        </p>
        <div className="a-ratios" role="group" aria-label="Placement">
          {PLACEMENTS.map((x, i) => <button key={x.label} type="button" aria-pressed={i === at} onClick={() => setAt(i)}>{x.label}</button>)}
        </div>
      </div>
    </section>
  );
}

const BOARDS = [["1 / 1", "1:1"], ["4 / 5", "4:5"], ["1 / 1", "1:1"]] as const;

function Services({ site }: { site: SiteProfile }) {
  return (
    <section id="services" className="a-section" aria-labelledby="a-services">
      <h2 id="a-services" className="a-h2">What we make</h2>
      <div className="a-wall">
        {site.services.map((s, i) => {
          const [ratio, label] = BOARDS[i % BOARDS.length]!;
          return (
            <Board key={s.name} ratio={ratio} spec={`${String(i + 1).padStart(2, "0")} · ${label}`} className={`a-wall__${i % 3}`}>
              <h3 className="a-h3">{s.name}</h3>
              <p className="a-board__head">{s.headline}</p>
              <p>{s.description}</p>
              <ul className="a-list">{s.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
            </Board>
          );
        })}
      </div>
    </section>
  );
}

function Insights({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section id="insights" className="a-section" aria-labelledby="a-insights">
      <h2 id="a-insights" className="a-h2">Notes</h2>
      <p className="a-sub">Published by {site.company} after review.</p>
      <ul className="a-posts">{posts.map((post) => <li key={post.id}><a className="a-post" href={post.path}><span>{post.postedAt ?? post.scheduledFor}</span><b>{post.title}</b><Arrow /></a></li>)}</ul>
    </section>
  );
}

function Who({ site }: { site: SiteProfile }) {
  const { title, subtitle, segments } = site.whoWeServe;
  return (
    <section id="who" className="a-section" aria-labelledby="a-who">
      <h2 id="a-who" className="a-h2">{title}</h2>
      <p className="a-statement">{subtitle}</p>
      <ul className="a-segments">{segments.map((s) => <li key={s.name}><h3 className="a-h3 a-h3--s">{s.name}</h3><p>{s.description}</p></li>)}</ul>
    </section>
  );
}

function Process({ site }: { site: SiteProfile }) {
  const { title, subtitle, steps } = site.process;
  return (
    <section id="process" className="a-section" aria-labelledby="a-process">
      <h2 id="a-process" className="a-h2">{title}</h2>
      <p className="a-sub">{subtitle}</p>
      <ol className="a-board-strip">
        {steps.map((step, i) => (
          <li key={step.title}>
            <div className="a-panel"><Crops /><span className="a-panel__sc" aria-hidden="true">SC {String(i + 1).padStart(2, "0")}</span><h3 className="a-panel__word">{step.title}</h3></div>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Pricing({ site }: { site: SiteProfile }) {
  const { title, subtitle, tiers } = site.pricing;
  return (
    <section id="pricing" className="a-section" aria-labelledby="a-pricing">
      <h2 id="a-pricing" className="a-h2">{title}</h2>
      <p className="a-sub">{subtitle}</p>
      <div className="a-tiers">
        {tiers.map((tier) => (
          <article key={tier.name} className={`a-tier${tier.featured ? " is-featured" : ""}`} aria-labelledby={`a-tier-${tier.name}`}>
            <h3 id={`a-tier-${tier.name}`} className="a-tier__name">{tier.name}</h3>
            <p className="a-tier__price">{tier.price}{tier.cadence ? ` ${tier.cadence}` : ""}</p>
            <p className="a-tier__blurb">{tier.blurb}</p>
            <ul className="a-list">{tier.includes.map((x) => <li key={x}>{x}</li>)}</ul>
            <a className={tier.featured ? "a-btn" : "a-link"} href="#contact" aria-label={`${site.hero.cta}: ${tier.name}`}><span>{site.hero.cta}</span>{tier.featured ? <Arrow /> : null}</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function Faq({ site }: { site: SiteProfile }) {
  return (
    <section id="faq" className="a-section" aria-labelledby="a-faq">
      <h2 id="a-faq" className="a-h2">{site.faq.title}</h2>
      <dl className="a-faq">{site.faq.items.map((item) => <div key={item.question}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl>
    </section>
  );
}

function Contact({ site }: { site: SiteProfile }) {
  const { form, set, toggle, state, onSubmit } = useLeadForm();
  const field = (label: string, key: "company" | "website" | "name" | "email", extra: { type?: string; placeholder?: string; autoComplete?: string } = {}) => (
    <label className="a-field"><span>{label}</span><input id={`a-${key}`} required value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} /></label>
  );
  return (
    <section id="contact" className="a-contact" aria-labelledby="a-contact-title">
      <div className="a-contact__head">
        <p className="a-spec a-spec--static" aria-hidden="true">brief · 1 of 1</p>
        <h2 id="a-contact-title" className="a-finale">{site.contact.title}</h2>
        <p className="a-contact__sub">{site.contact.subtitle}</p>
      </div>
      {state === "sent" ? (
        <p role="status" className="a-sent">Received. We reply within one business day.</p>
      ) : (
        <form className="a-form" onSubmit={onSubmit}>
          {field("Brand", "company", { autoComplete: "organization" })}
          {field("Website", "website", { placeholder: "example.com", autoComplete: "url" })}
          {field("Your name", "name", { autoComplete: "name" })}
          {field("Work email", "email", { type: "email", autoComplete: "email" })}
          <fieldset className="a-choices">
            <legend>What do you need?</legend>
            {site.services.map((s) => <label key={s.name}><input type="checkbox" checked={form.services.includes(s.name)} onChange={() => toggle(s.name)} /><span>{s.name}</span></label>)}
          </fieldset>
          <label className="a-field a-field--wide"><span>What are you launching, and where will it run?</span><textarea id="a-note" rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} /></label>
          <div className="a-form__send">
            <button className="a-btn a-btn--ink" type="submit" disabled={state === "sending"}><span>{state === "sending" ? "Sending" : site.hero.cta}</span><Arrow /></button>
            {state === "offline" ? <p role="status">{site.contact.offlineNote} <a className="a-inline" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p> : null}
          </div>
        </form>
      )}
    </section>
  );
}

function Footer({ site }: { site: SiteProfile }) {
  return (
    <footer className="a-foot">
      <p className="a-foot__mark" aria-hidden="true" style={{ ["--chars" as string]: site.company.length }}>{site.company}</p>
      <div className="a-foot__row"><span>{site.footer.note}</span><a className="a-draw" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></div>
    </footer>
  );
}

export default function StudioSite({ site, blog = [] }: { site: SiteProfile; blog?: PublicPost[] }) {
  return (
    <div id="top" className="a-site">
      <a className="a-skip" href="#main">Skip to content</a>
      <Header site={site} posts={blog} />
      <main id="main">
        <Hero site={site} />
        <Services site={site} />
        <Insights site={site} posts={blog} />
        <Who site={site} />
        <Process site={site} />
        <Pricing site={site} />
        <Faq site={site} />
        <Contact site={site} />
      </main>
      <Footer site={site} />
    </div>
  );
}
