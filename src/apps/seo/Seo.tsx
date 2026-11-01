import type { Connection } from "../../../server/proxy";
import { useApi } from "../../api";
import { AppWork } from "../AppWork";
import { Card, CheckRow } from "../../components/checks";
import { PageHeader } from "../../components/kit";

/**
 * SEO & GEO (ADR-1766): the search work filed for clients, and whether search is measured. The
 * agency's own site is checked in the landing page app, which serves it.
 */
export function Seo() {
  const audit = useApi<{ data: Connection[] }>("/accounts");
  const connections = audit.data?.data ?? [];
  const connected = (pattern: RegExp) => connections.some((c) => pattern.test(c.connector) && c.status === "connected");

  return (
    <div className="pane-in">
      <PageHeader
        title="SEO & GEO"
        subtitle="The search work filed for clients — pages, articles, answer blocks, ranking reports and audits — and whether search is measured."
      />
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <Card title="Measurement">
            {audit.error ? <p className="text-sm text-ink-3">Connections are read from the platform: {audit.error}.</p> : (
              <>
                <CheckRow done={connected(/search.?console/i)}>Google Search Console connected</CheckRow>
                <CheckRow done={connected(/analytics/i)}>Google Analytics connected</CheckRow>
                <p className="mt-2 text-xs text-ink-3">Rankings and traffic count as verified only once these are connected to the agency identity.</p>
              </>
            )}
          </Card>
        </div>
        <section className="panel p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Search work for clients</h2>
          <AppWork app="seo-geo" none="This template files no search deliverables for clients." />
        </section>
      </section>
    </div>
  );
}
