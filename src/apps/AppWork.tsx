import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useApi } from "../api";
import type { AppId } from "../../templates";
import { TEMPLATE, type Post } from "../data";
import { KindChip, StatusChip } from "../components/kit";

/**
 * This app's own queue of work (ADR-1766), grouped by client. The clients are the CRM's, so each
 * row carries the name the filing agent gave. It lists and links; deciding stays on the client's
 * page, beside the draft's own words (`ClientPosts`), so nothing is approved from a one-line row.
 */
export function AppWork({ app, none }: { app: Exclude<AppId, "crm">; none: string }) {
  const posts = useApi<Post[]>("/posts");
  const kinds = new Set(TEMPLATE.kinds.filter((k) => k.app === app).map((k) => k.id));
  if (kinds.size === 0) return <p className="absence">{none}</p>;
  if (posts.error) return <p className="notice-fail">{posts.error}</p>;
  if (posts.data === null) return <p className="absence">Reading the queue…</p>;

  const rows = posts.data.filter((p) => kinds.has(p.kind));
  if (rows.length === 0) return <p className="absence">Nothing filed yet. It appears here as the agents file it.</p>;
  const names = new Map(rows.map((p) => [p.clientId, p.clientName ?? p.clientId]));
  const byClient = [...new Set(rows.map((p) => p.clientId))];
  return (
    <div className="space-y-4">
      {byClient.map((clientId) => (
        <section key={clientId}>
          <header className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{names.get(clientId) ?? clientId}</h3>
            <Link to={`/work/${clientId}`} className="btn btn-ghost btn-sm">
              Read and decide <ArrowRight size={13} strokeWidth={1.75} />
            </Link>
          </header>
          <div className="list">
            {rows.filter((p) => p.clientId === clientId).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <StatusChip status={p.status} />
                  </div>
                  <div className="mt-0.5 truncate text-sm text-ink-2">{p.summary}</div>
                </div>
                <KindChip kind={p.kind} channel={p.channel} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
