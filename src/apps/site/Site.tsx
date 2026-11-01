import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { site as holding, type SiteProfile } from "../../../site/site.config";
import { publishedArticle } from "../../../server/public-site";
import { useApi } from "../../api";
import { AppWork } from "../AppWork";
import { Card, CheckRow, readCrawlChecks, type CrawlCheck } from "../../components/checks";
import { PageHeader } from "../../components/kit";
import type { Client, Post } from "../../data";
import { siteChecks } from "./checks";

/** Whether the words reach a crawler that runs no scripts: the served home page carries a heading. */
const readsWithoutScripts = async (): Promise<boolean> => (await (await fetch("/")).text()).includes("<h1");

/**
 * The landing page app (ADR-1766): the agency's public site as search engines and AI read it, the
 * leads its contact form has taken (the sales agent files each into the CRM), and its blog's queue.
 */
export function Site() {
  const site = useApi<SiteProfile>("/site");
  const posts = useApi<Post[]>("/posts");
  const leads = useApi<Client[]>("/clients");
  const [crawl, setCrawl] = useState<CrawlCheck[] | null>(null);
  const [plain, setPlain] = useState<boolean | null>(null);
  useEffect(() => {
    void readCrawlChecks().then(setCrawl).catch(() => setCrawl([]));
    void readsWithoutScripts().then(setPlain).catch(() => setPlain(false));
  }, []);

  const articles = (posts.data ?? []).filter((p) => publishedArticle(p)).length;
  const inbox = [...(leads.data ?? [])].reverse();

  return (
    <div className="pane-in">
      <PageHeader
        title="Landing page"
        subtitle="Your public site as search engines and AI assistants read it, the leads its contact form has taken, and its blog."
        actions={<a href="/" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Open the site <ExternalLink size={13} /></a>}
      />
      <section className="grid gap-4 xl:grid-cols-2">
        <Card title="How search engines and AI read it">
          {site.error ? <p className="notice-fail">{site.error}</p> : site.data === null ? <p className="text-sm text-ink-3">Reading the site…</p> : (
            siteChecks(site.data, holding.company, articles).map((c) => (
              <CheckRow key={c.label} done={c.done}>{c.label}<span className="block text-xs text-ink-3">{c.detail}</span></CheckRow>
            ))
          )}
          {plain === null ? null : (
            <CheckRow done={plain}>
              Page text in the first response
              <span className="block text-xs text-ink-3">{plain ? "A crawler that runs no scripts reads the headings." : "Not yet: the page's words render in the browser, so a crawler that runs no scripts reads only the title, description and structured data."}</span>
            </CheckRow>
          )}
          <div className="mt-3 border-t border-line pt-3">
            {crawl === null ? <p className="text-sm text-ink-3">Checking the public files…</p> : crawl.map((row) => (
              <CheckRow key={row.name} done={row.ok}><span className="font-mono">/{row.name}</span> · {row.detail}</CheckRow>
            ))}
          </div>
        </Card>
        <Card title="Leads from the contact form">
          {leads.error ? <p className="notice-fail">{leads.error}</p> : leads.data === null ? <p className="text-sm text-ink-3">Reading the inbox…</p>
            : inbox.length === 0 ? <p className="text-sm text-ink-3">No one has written in yet. Each lead lands here, and the sales agent files it into the CRM on its next run.</p>
            : (
              <div className="list">
                {inbox.map((lead) => (
                  <div key={lead.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{lead.name}</span>
                      <span className="block truncate font-mono text-xs text-ink-3" title={lead.contact.email}>{lead.contact.email}</span>
                    </div>
                    <span className={`chip ${lead.filed ? "chip-credit" : "chip-absent"}`}>{lead.filed ? "In the CRM" : "Waiting for sales"}</span>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </section>
      <section className="panel mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold">The blog</h2>
        <AppWork app="landing-page" none="This template writes no articles for the agency's own blog." />
      </section>
    </div>
  );
}
