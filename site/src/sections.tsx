import type { ReactNode } from "react";
import { site } from "../site.config.ts";

function Section({ id, eyebrow, title, subtitle, children }: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="h2 mt-3 max-w-2xl">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-muted">{subtitle}</p> : null}
      <div className="mt-10">{children}</div>
    </section>
  );
}

export function Services() {
  return (
    <Section id="services" eyebrow="Services" title="Three disciplines, one goal: being found">
      <div className="grid gap-5 md:grid-cols-3">
        {site.services.map((service) => (
          <article key={service.name} className="card p-7">
            <p className="eyebrow">{service.name}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{service.headline}</h3>
            <p className="mt-3 text-sm text-muted">{service.description}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {service.deliverables.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function Process() {
  return (
    <Section id="process" eyebrow="Process" title={site.process.title} subtitle={site.process.subtitle}>
      <ol className="grid gap-5 md:grid-cols-4">
        {site.process.steps.map((step, i) => (
          <li key={step.title} className="card p-6">
            <span className="text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function CaseStudies() {
  const { title, empty, items } = site.caseStudies;
  return (
    <Section id="work" eyebrow="Work" title={title}>
      {items.length === 0 ? (
        <p className="card p-7 text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {items.map((cs) => (
            <article key={cs.client} className="card flex flex-col p-7">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                {cs.client} · {cs.industry}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">{cs.headline}</h3>
              <p className="mt-3 flex-1 text-sm text-muted">{cs.result}</p>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
                {cs.metrics.map((m) => (
                  <div key={m.label}>
                    <dd className="text-lg font-semibold tracking-tight text-accent">{m.value}</dd>
                    <dt className="mt-0.5 text-xs text-muted">{m.label}</dt>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

export function Testimonials() {
  const { title, empty, items } = site.testimonials;
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="eyebrow">{title}</p>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{empty}</p>
        ) : (
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            {items.map((t) => (
              <figure key={t.name}>
                <blockquote className="text-lg font-medium leading-snug tracking-tight">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm text-muted">
                  <span className="font-semibold text-ink">{t.name}</span> — {t.role}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <Section id="pricing" eyebrow="Pricing" title={site.pricing.title} subtitle={site.pricing.subtitle}>
      <div className="grid gap-5 md:grid-cols-3">
        {site.pricing.tiers.map((tier) => (
          <article key={tier.name} className={`card p-7 ${tier.featured ? "outline-2 outline-accent" : ""}`}>
            <h3 className="font-semibold">{tier.name}</h3>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {tier.price}
              <span className="text-sm font-normal text-muted">{tier.cadence}</span>
            </p>
            <p className="mt-3 text-sm text-muted">{tier.blurb}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {tier.includes.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <a href="#contact" className={`btn mt-7 w-full ${tier.featured ? "btn-accent" : "btn-ghost"}`}>
              {site.hero.cta}
            </a>
          </article>
        ))}
      </div>
    </Section>
  );
}
