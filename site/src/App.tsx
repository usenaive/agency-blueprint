import { site } from "../site.config.ts";
import { Contact } from "./Contact.tsx";
import { CaseStudies, Pricing, Process, Services, Testimonials } from "./sections.tsx";

const NAV = [
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Work", href: "#work" },
  { label: "Pricing", href: "#pricing" },
];

function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ground/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-base font-semibold tracking-tight">
          {site.company}
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted sm:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>
        <a href="#contact" className="btn btn-accent !px-4 !py-2 text-sm">
          {site.hero.cta}
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center sm:pt-32">
      <p className="eyebrow">{site.hero.eyebrow}</p>
      <h1 className="display mx-auto mt-4 max-w-3xl">{site.hero.title}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">{site.hero.subtitle}</p>
      <div className="mt-9 flex items-center justify-center gap-3">
        <a href="#contact" className="btn btn-accent">
          {site.hero.cta}
        </a>
        <a href="#process" className="btn btn-ghost">
          {site.hero.secondaryCta}
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted sm:flex-row">
        <span className="font-medium text-ink">{site.company}</span>
        <span>{site.footer.note}</span>
        <a href={`mailto:${site.contact.email}`} className="hover:text-ink">
          {site.contact.email}
        </a>
      </div>
    </footer>
  );
}

export function App() {
  return (
    <div id="top">
      <Nav />
      <main>
        <Hero />
        <Services />
        <Process />
        <CaseStudies />
        <Testimonials />
        <Pricing />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
