import { useApi } from "../../api";
import { AppWork } from "../AppWork";
import { Card, CheckRow } from "../../components/checks";
import { PageHeader } from "../../components/kit";
import { TEMPLATE } from "../../data";
import type { Connection } from "../../../server/proxy";

/**
 * Ads, for every template: the ad accounts the agency identity has connected, and every ad
 * deliverable filed for clients. No seat of any template launches or spends; this screen shows
 * the work and the accounts, and the decisions stay with the drafts.
 */
export function Ads() {
  // The server answers only the ad accounts (`/api/accounts` on the ads app).
  const audit = useApi<{ data: Connection[] }>("/accounts");
  const accounts = audit.data?.data ?? [];
  const kinds = TEMPLATE.kinds.filter((k) => k.app === "ads").map((k) => k.label);

  return (
    <div className="pane-in">
      <PageHeader
        title="Ads"
        subtitle={kinds.length > 0 ? `Ad work filed for clients (${kinds.join(", ").toLowerCase()}) and the ad accounts connected. Nothing here launches or spends.` : "Ad work filed for clients and the ad accounts connected. Nothing here launches or spends."}
      />
      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <Card title="Ad accounts">
            {audit.error ? <p className="text-sm text-ink-3">Accounts are read from the platform: {audit.error}.</p>
              : audit.data === null ? <p className="text-sm text-ink-3">Reading connections…</p>
              : accounts.length === 0 ? <p className="text-sm text-ink-3">No ad account connected to the agency identity yet. Connect one from Connections; agents read it, never change it.</p>
              : accounts.map((a) => <CheckRow key={a.connector} done={a.status === "connected"}>{a.connector}<span className="block text-xs text-ink-3">{a.status}</span></CheckRow>)}
          </Card>
        </div>
        <section className="panel p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Ad work for clients</h2>
          <AppWork app="ads" none="No agent in this template writes ads, so nothing is filed here yet. Ad work from any template that does appears by client." />
        </section>
      </section>
    </div>
  );
}
