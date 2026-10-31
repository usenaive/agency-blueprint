/**
 * The `seo-geo` template's public site (DESIGN.md beside this file). It renders the same
 * `site_profile` as the default site, so every word is still the operator's and still edited
 * through `update_site`. What it adds is the machine margin: each block's reading as a crawler or
 * an assistant gets it — its tag, the JSON-LD type `applySeo` emits for it, its word count — all
 * computed from the page, never asserted.
 */
import "@fontsource-variable/host-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./search.css";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { SiteProfile } from "../../../site.config.ts";
import type { PublicPost } from "../../profile.ts";
import { useLeadForm } from "../useLeadForm.ts";
import { startParse } from "./parse.ts";

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** One block of the page and its machine reading in the margin. */
function Block({ name, notes, className = "", children }: { name: string; notes: string[]; className?: string; children: ReactNode }) {
  return (
    <div className={`s-block ${className}`} data-parse={name}>
      <p className="s-note" aria-hidden="true">
        {notes.map((note) => <span key={note}>{note}</span>)}
      </p>
      <div className="s-body">{children}</div>
    </div>
  );
}

function Arrow() {
  return <svg className="s-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

function Header({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  const nav = [["Services", "#services"], ...(posts.length ? [["Insights", "#insights"]] : []), ["Process", "#process"], ["Pricing", "#pricing"], ["FAQ", "#faq"]];
  const jump = useRef<HTMLDetailsElement>(null);
  return (
    <header className="s-head">
      <a className="s-mark" href="#top">{site.company}</a>
      <nav aria-label="Sections" className="s-nav">
        {nav.map(([label, href]) => <a key={href} className="s-draw" href={href}>{label}</a>)}
      </nav>
      <details className="s-jump" ref={jump}>
        <summary>Sections</summary>
        <nav aria-label="Sections">
          {[...nav, [site.hero.cta, "#contact"]].map(([label, href]) => <a key={href} href={href} onClick={() => jump.current?.removeAttribute("open")}>{label}</a>)}
        </nav>
      </details>
      <span className="s-status" aria-hidden="true">parsing <b data-parse-now>hero</b><i className="s-caret" /></span>
      <a className="s-btn s-btn--small" href="#contact"><span>{site.hero.cta}</span></a>
    </header>
  );
}

/** What a crawler reads off this page's head: all of it computed from the same profile `applySeo` writes. */
function Inspector({ site }: { site: SiteProfile }) {
  const host = typeof location === "undefined" ? "" : location.hostname;
  const title = `${site.company} — ${site.tagline}`;
  const rows: [string, string][] = [
    ["title", `${title.length} characters`],
    ["description", `${words(site.hero.subtitle)} words`],
    ["h1", "1"],
    ["@type", "ProfessionalService"],
    ["@type", `FAQPage, ${site.faq.items.length} questions`],
    ["knowsAbout", site.services.map((s) => s.name).join(", ")],
  ];
  return (
    <figure className="s-inspect" aria-label="What search engines and assistants read from this page">
      <figcaption className="s-inspect__bar"><span>{host || "this page"}</span><span>machine reading</span></figcaption>
      <blockquote className="s-inspect__quote">
        <p>{site.hero.subtitle}</p>
        <footer>The sentence this page offers an assistant to quote, as <b>description</b> and <b>ProfessionalService.description</b>.</footer>
      </blockquote>
      <dl className="s-inspect__rows">
        {rows.map(([k, v]) => <div key={k + v}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </figure>
  );
}

function Hero({ site }: { site: SiteProfile }) {
  return (
    <section className="s-hero" aria-labelledby="s-h1">
      <span className="s-sweep" data-sweep aria-hidden="true" />
      <Block name="hero" notes={["<h1>", "the page's one title"]} className="s-hero__title">
        <p className="s-kicker">{site.hero.eyebrow}</p>
        <h1 id="s-h1" className="s-display">{site.hero.title}</h1>
      </Block>
      <div className="s-hero__foot">
        <div className="s-hero__lede">
          <p className="s-lede">{site.hero.subtitle}</p>
          <div className="s-actions">
            <a className="s-btn" href="#contact"><span>{site.hero.cta}</span><Arrow /></a>
            <a className="s-link" href="#process">{site.hero.secondaryCta}</a>
          </div>
        </div>
        <Inspector site={site} />
      </div>
    </section>
  );
}

function Proof({ site }: { site: SiteProfile }) {
  return (
    <section className="s-section s-proof" aria-labelledby="s-proof">
      <h2 id="s-proof" className="s-sr">How we work</h2>
      <Block name="ground rules" notes={["<ul>", `${site.proof.facts.length} rules`]}>
        <ul className="s-rules">{site.proof.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </Block>
    </section>
  );
}

function Services({ site }: { site: SiteProfile }) {
  return (
    <section id="services" className="s-section" aria-labelledby="s-services">
      <Block name="services" notes={["<h2>", "knowsAbout"]}>
        <h2 id="s-services" className="s-h2">What we do</h2>
      </Block>
      <ol className="s-index">
        {site.services.map((service) => (
          <li key={service.name}>
            <Block name={service.name} notes={[`knowsAbout: "${service.name}"`, `${service.deliverables.length} deliverables`]} className="s-row">
              <p className="s-row__name">{service.name}</p>
              <div className="s-row__text">
                <h3 className="s-h3">{service.headline}</h3>
                <p>{service.description}</p>
              </div>
              <ul className="s-row__list">{service.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
            </Block>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Insights({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section id="insights" className="s-section" aria-labelledby="s-insights">
      <Block name="insights" notes={["<h2>", `${posts.length} articles`]}>
        <h2 id="s-insights" className="s-h2">Field notes</h2>
        <p className="s-sub">Published by {site.company} after review.</p>
      </Block>
      <ul className="s-posts">
        {posts.map((post) => (
          <li key={post.id}>
            <a className="s-post" href={post.path}>
              <span className="s-post__date">{post.postedAt ?? post.scheduledFor}</span>
              <span className="s-post__title">{post.title}</span>
              <Arrow />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Who({ site }: { site: SiteProfile }) {
  const { title, subtitle, segments } = site.whoWeServe;
  return (
    <section id="who" className="s-section" aria-labelledby="s-who">
      <Block name="who we serve" notes={["<h2>", "audience"]}>
        <h2 id="s-who" className="s-h2">{title}</h2>
        <p className="s-statement">{subtitle}</p>
      </Block>
      <ul className="s-segments">
        {segments.map((s) => <li key={s.name}><h3 className="s-h3">{s.name}</h3><p>{s.description}</p></li>)}
      </ul>
    </section>
  );
}

function Process({ site }: { site: SiteProfile }) {
  const { title, subtitle, steps } = site.process;
  return (
    <section id="process" className="s-section" aria-labelledby="s-process">
      <Block name="process" notes={["<ol>", `${steps.length} steps`]}>
        <h2 id="s-process" className="s-h2">{title}</h2>
        <p className="s-sub">{subtitle}</p>
      </Block>
      <div className="s-steps">
        <span className="s-steps__rule" data-rule aria-hidden="true" />
        <ol>
          {steps.map((step, i) => (
            <li key={step.title}>
              <span className="s-steps__n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="s-h3">{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Pricing({ site }: { site: SiteProfile }) {
  const { title, subtitle, tiers } = site.pricing;
  return (
    <section id="pricing" className="s-section" aria-labelledby="s-pricing">
      <Block name="pricing" notes={["<h2>", `${tiers.length} tiers`]}>
        <h2 id="s-pricing" className="s-h2">{title}</h2>
        <p className="s-sub">{subtitle}</p>
      </Block>
      <div className="s-tiers">
        {tiers.map((tier) => (
          <article key={tier.name} className={`s-tiercol${tier.featured ? " is-featured" : ""}`} aria-labelledby={`s-tier-${tier.name}`}>
            <h3 id={`s-tier-${tier.name}`} className="s-tiername">{tier.name}</h3>
            <p className="s-price"><span>price</span>{tier.price}{tier.cadence ? ` ${tier.cadence}` : ""}</p>
            <p className="s-tierblurb">{tier.blurb}</p>
            <ul className="s-includes">{tier.includes.map((item) => <li key={item}>{item}</li>)}</ul>
            <a className={tier.featured ? "s-btn" : "s-link"} href="#contact" aria-label={`${site.hero.cta}: ${tier.name}`}>
              <span>{site.hero.cta}</span>{tier.featured ? <Arrow /> : null}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function Faq({ site }: { site: SiteProfile }) {
  return (
    <section id="faq" className="s-section" aria-labelledby="s-faq">
      <Block name="faq" notes={["<h2>", "FAQPage"]}>
        <h2 id="s-faq" className="s-h2">{site.faq.title}</h2>
      </Block>
      <div className="s-faq">
        {site.faq.items.map((item) => (
          <Block key={item.question} name="answer" notes={["Question", `answer: ${words(item.answer)} words`]} className="s-qa">
            <h3 className="s-h3">{item.question}</h3>
            <p>{item.answer}</p>
          </Block>
        ))}
      </div>
    </section>
  );
}

function Contact({ site }: { site: SiteProfile }) {
  const { form, set, toggle, state, onSubmit } = useLeadForm();
  const field = (label: string, key: "company" | "website" | "name" | "email", extra: { type?: string; placeholder?: string; autoComplete?: string } = {}) => (
    <label className="s-field">
      <span>{label}</span>
      <input id={`s-${key}`} required value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <section id="contact" className="s-section s-contact" aria-labelledby="s-contact">
      <Block name="contact" notes={["<form>", "POST, to a person"]}>
        <h2 id="s-contact" className="s-finale">{site.contact.title}</h2>
        <p className="s-sub">{site.contact.subtitle}</p>
      </Block>
      {state === "sent" ? (
        <p role="status" className="s-sent">Received. We reply within one business day.</p>
      ) : (
        <form className="s-form" onSubmit={onSubmit}>
          {field("Company", "company", { autoComplete: "organization" })}
          {field("Website", "website", { placeholder: "example.com", autoComplete: "url" })}
          {field("Your name", "name", { autoComplete: "name" })}
          {field("Work email", "email", { type: "email", autoComplete: "email" })}
          <fieldset className="s-choices">
            <legend>What do you need?</legend>
            {site.services.map((s) => (
              <label key={s.name}><input type="checkbox" checked={form.services.includes(s.name)} onChange={() => toggle(s.name)} /><span>{s.name}</span></label>
            ))}
          </fieldset>
          <label className="s-field s-field--wide">
            <span>Anything else</span>
            <textarea id="s-note" rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
          <div className="s-form__send">
            <button className="s-btn" type="submit" disabled={state === "sending"}>
              <span>{state === "sending" ? "Sending" : site.hero.cta}</span><Arrow />
            </button>
            {state === "offline" ? (
              <p role="status">{site.contact.offlineNote} <a className="s-inline" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}

function Footer({ site }: { site: SiteProfile }) {
  return (
    <footer className="s-foot">
      <p className="s-foot__mark" aria-hidden="true" style={{ "--chars": site.company.length } as CSSProperties}>{site.company}</p>
      <div className="s-foot__row">
        <span>{site.footer.note}</span>
        <span>{site.tagline}</span>
        <a className="s-draw" href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
      </div>
    </footer>
  );
}

export default function SearchSite({ site, blog = [] }: { site: SiteProfile; blog?: PublicPost[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => (root.current ? startParse(root.current) : undefined), []);
  return (
    <div id="top" className="s-site" ref={root}>
      <a className="s-skip" href="#main">Skip to content</a>
      <Header site={site} posts={blog} />
      <div className="s-parse" aria-hidden="true"><span className="s-parse__tick" /></div>
      <main id="main">
        <Hero site={site} />
        <Proof site={site} />
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
