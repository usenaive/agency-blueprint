/**
 * The `security` template's public site (DESIGN.md beside this file). Same `site_profile` as every
 * theme. Its signature is the console in the hero: a passive check of this page, read from the
 * headers the browser actually received (`check.ts`); every line resolves at once when the result arrives.
 */
import "@fontsource-variable/instrument-sans/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "./security.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SiteProfile } from "../../../site.config.ts";
import type { PublicPost } from "../../profile.ts";
import { useLeadForm } from "../useLeadForm.ts";
import { checkThisPage, type CheckLine } from "./check.ts";

const NAMES = ["HTTPS", "HSTS", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy", "Framing protection"];
const LABEL = { pass: "pass", missing: "not set", note: "note" } as const;

function Arrow() {
  return <svg className="g-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

function Header({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  const nav = [["Services", "#services"], ...(posts.length ? [["Insights", "#insights"]] : []), ["Process", "#process"], ["Engagements", "#pricing"], ["FAQ", "#faq"]];
  const jump = useRef<HTMLDetailsElement>(null);
  return (
    <header className="g-head">
      <a className="g-mark" href="#top"><span className="g-mark__gate" aria-hidden="true" />{site.company}</a>
      <nav aria-label="Sections" className="g-nav">
        {nav.map(([label, href]) => <a key={href} className="g-draw" href={href}>{label}</a>)}
      </nav>
      <details className="g-jump" ref={jump}>
        <summary>Sections</summary>
        <nav aria-label="Sections">
          {[...nav, [site.hero.cta, "#contact"]].map(([label, href]) => <a key={href} href={href} onClick={() => jump.current?.removeAttribute("open")}>{label}</a>)}
        </nav>
      </details>
      <a className="g-btn g-btn--small" href="#contact"><span>{site.hero.cta}</span></a>
    </header>
  );
}

/** The signature: this page's own passive check, from the headers this browser received. */
function Console() {
  const [lines, setLines] = useState<CheckLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void checkThisPage().then((result) => {
      if (!live) return;
      if (result === null) return setFailed(true);
      setLines(result);
    });
    return () => { live = false; };
  }, []);
  const host = typeof location === "undefined" ? "" : location.hostname;
  const done = lines !== null;
  const inPlace = lines?.filter((l) => l.status === "pass").length ?? 0;
  return (
    <figure className="g-console" aria-labelledby="g-console-title">
      <figcaption className="g-console__bar">
        <span id="g-console-title">passive check · {host || "this page"}</span>
        <span>read-only</span>
      </figcaption>
      <ol className="g-console__lines">
        {NAMES.map((name, i) => {
          const line = lines?.[i];
          const ready = line !== undefined;
          return (
            <li key={name} className={ready ? `is-${line.status}` : "is-pending"}>
              <span className="g-console__name">{name}</span>
              <span className="g-console__detail">{ready ? line.detail : failed ? "unavailable" : "checking"}</span>
              <span className="g-console__status">{ready ? LABEL[line.status] : "·"}</span>
            </li>
          );
        })}
      </ol>
      <p className="g-console__sum" aria-live="polite">
        {failed ? "This check could not run in this browser." : done ? `${inPlace} of ${lines!.length} in place on this page.` : "Reading this page's response…"}
      </p>
      <p className="g-console__rule">Run from your browser against this page only. No ports, no logins. We test other products only when their owner hires us.</p>
    </figure>
  );
}

function Hero({ site }: { site: SiteProfile }) {
  return (
    <section className="g-hero" aria-labelledby="g-h1">
      <div className="g-hero__text">
        <p className="g-kicker">{site.hero.eyebrow}</p>
        <h1 id="g-h1" className="g-display">{site.hero.title}</h1>
        <p className="g-lede">{site.hero.subtitle}</p>
        <div className="g-actions">
          <a className="g-btn" href="#contact"><span>{site.hero.cta}</span><Arrow /></a>
          <a className="g-link g-link--light" href="#process">{site.hero.secondaryCta}</a>
        </div>
      </div>
      <Console />
    </section>
  );
}

function Section({ id, title, sub, children, className = "" }: { id: string; title: string; sub?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`g-section ${className}`} aria-labelledby={`g-${id}`}>
      <div className="g-section__head">
        <h2 id={`g-${id}`} className="g-h2">{title}</h2>
        {sub ? <p className="g-sub">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Rules({ site }: { site: SiteProfile }) {
  return (
    <section className="g-rules" aria-label="How we work">
      <ul>{site.proof.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
    </section>
  );
}

function Services({ site }: { site: SiteProfile }) {
  return (
    <Section id="services" title="What a review covers">
      <div className="g-report">
        {site.services.map((service) => (
          <article key={service.name} className="g-report__row" aria-labelledby={`g-svc-${service.name}`}>
            <h3 id={`g-svc-${service.name}`} className="g-report__name">{service.name}</h3>
            <div className="g-report__text">
              <p className="g-h3">{service.headline}</p>
              <p>{service.description}</p>
            </div>
            <ul className="g-check">{service.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Insights({ site, posts }: { site: SiteProfile; posts: PublicPost[] }) {
  if (posts.length === 0) return null;
  return (
    <Section id="insights" title="Advisories and notes" sub={`Published by ${site.company} after review.`}>
      <ul className="g-posts">
        {posts.map((post) => (
          <li key={post.id}><a className="g-post" href={post.path}><span>{post.postedAt ?? post.scheduledFor}</span><b>{post.title}</b><Arrow /></a></li>
        ))}
      </ul>
    </Section>
  );
}

function Who({ site }: { site: SiteProfile }) {
  const { title, subtitle, segments } = site.whoWeServe;
  return (
    <Section id="who" title={title}>
      <p className="g-statement">{subtitle}</p>
      <ul className="g-segments">{segments.map((s) => <li key={s.name}><h3 className="g-h3">{s.name}</h3><p>{s.description}</p></li>)}</ul>
    </Section>
  );
}

function Process({ site }: { site: SiteProfile }) {
  const { title, subtitle, steps } = site.process;
  return (
    <Section id="process" title={title} sub={subtitle}>
      <ol className="g-steps">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span className="g-steps__n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="g-h3">{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Pricing({ site }: { site: SiteProfile }) {
  const { title, subtitle, tiers } = site.pricing;
  return (
    <Section id="pricing" title={title} sub={subtitle}>
      <div className="g-tiers">
        {tiers.map((tier) => (
          <article key={tier.name} className={`g-tier${tier.featured ? " is-featured" : ""}`} aria-labelledby={`g-tier-${tier.name}`}>
            <h3 id={`g-tier-${tier.name}`} className="g-tier__name">{tier.name}</h3>
            <p className="g-tier__price">{tier.price}{tier.cadence ? ` ${tier.cadence}` : ""}</p>
            <p className="g-tier__blurb">{tier.blurb}</p>
            <ul className="g-check">{tier.includes.map((item) => <li key={item}>{item}</li>)}</ul>
            <a className={tier.featured ? "g-btn" : "g-link"} href="#contact" aria-label={`${site.hero.cta}: ${tier.name}`}>
              <span>{site.hero.cta}</span>{tier.featured ? <Arrow /> : null}
            </a>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Faq({ site }: { site: SiteProfile }) {
  return (
    <Section id="faq" title={site.faq.title}>
      <div className="g-faq">
        {site.faq.items.map((item, i) => (
          <details key={item.question} open={i === 0}>
            <summary><h3 className="g-h3">{item.question}</h3></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Contact({ site }: { site: SiteProfile }) {
  const { form, set, toggle, state, onSubmit } = useLeadForm();
  const field = (label: string, key: "company" | "website" | "name" | "email", extra: { type?: string; placeholder?: string; autoComplete?: string } = {}) => (
    <label className="g-field">
      <span>{label}</span>
      <input id={`g-${key}`} required value={form[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <section id="contact" className="g-contact" aria-labelledby="g-contact-title">
      <div className="g-contact__head">
        <h2 id="g-contact-title" className="g-finale">{site.contact.title}</h2>
        <p className="g-lede">{site.contact.subtitle}</p>
      </div>
      {state === "sent" ? (
        <p role="status" className="g-sent">Received. We reply within one business day.</p>
      ) : (
        <form className="g-form" onSubmit={onSubmit}>
          {field("Company", "company", { autoComplete: "organization" })}
          {field("Domain to review", "website", { placeholder: "example.com", autoComplete: "url" })}
          {field("Your name", "name", { autoComplete: "name" })}
          {field("Work email", "email", { type: "email", autoComplete: "email" })}
          <fieldset className="g-choices">
            <legend>What do you need?</legend>
            {site.services.map((s) => (
              <label key={s.name}><input type="checkbox" checked={form.services.includes(s.name)} onChange={() => toggle(s.name)} /><span>{s.name}</span></label>
            ))}
          </fieldset>
          <label className="g-field g-field--wide">
            <span>Framework, deadline, or anything else</span>
            <textarea id="g-note" rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} />
          </label>
          <div className="g-form__send">
            <button className="g-btn" type="submit" disabled={state === "sending"}><span>{state === "sending" ? "Sending" : site.hero.cta}</span><Arrow /></button>
            <p className="g-form__note">We test nothing until you approve the test accounts.</p>
            {state === "offline" ? <p role="status">{site.contact.offlineNote} <a className="g-inline" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p> : null}
          </div>
        </form>
      )}
    </section>
  );
}

function Footer({ site }: { site: SiteProfile }) {
  return (
    <footer className="g-foot">
      <span>{site.company}</span>
      <span>{site.footer.note}</span>
      <a className="g-draw" href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
    </footer>
  );
}

export default function SecuritySite({ site, blog = [] }: { site: SiteProfile; blog?: PublicPost[] }) {
  return (
    <div id="top" className="g-site">
      <a className="g-skip" href="#main">Skip to content</a>
      <Header site={site} posts={blog} />
      <main id="main">
        <Hero site={site} />
        <Rules site={site} />
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
