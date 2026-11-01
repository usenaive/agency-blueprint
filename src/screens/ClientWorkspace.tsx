import { Link, Outlet, useLocation, useOutletContext, useParams } from "react-router";
import { useApi } from "../api";
import { StageChip } from "../components/kit";
import type { Client, Post } from "../data";

const TABS = [
  { to: "overview", label: "Overview" },
  { to: "posts", label: "Work" },
];

/** The CRM's page for one client: one header, two tabs, and the client record handed to each tab
 * through the outlet context. Its agents, calendar and connections are the Studio's. */
export function ClientWorkspace() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { data: clients, error } = useApi<Client[]>("/clients");

  if (clients === null) {
    return <div className="pane-in"><div className="absence">{error ?? "Loading the client…"}</div></div>;
  }
  const client = clients.find((c) => c.id === id);
  if (!client) return <div className="pane-in"><div className="absence">No such client.</div></div>;

  return (
    <div className="pane-in">
      <header className="mb-4 flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-ink"
          style={{ background: `hsl(${client.name.length * 37} 22% 86%)` }}
        >
          {client.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="page-title truncate">{client.name}</h1>
            <StageChip stage={client.stage} />
          </div>
          <div className="mt-0.5 font-mono text-xs text-ink-3">{client.domain} · {client.slug}</div>
        </div>
      </header>

      <div className="seg mb-5 w-fit" role="tablist">
        {TABS.map(({ to, label }) => (
          <Link key={to} to={to} className="seg-item" role="tab" aria-selected={pathname.endsWith(`/${to}`)}>
            {label}
          </Link>
        ))}
      </div>

      <Outlet context={client} />
    </div>
  );
}

export function useClient(): Client {
  return useOutletContext<Client>();
}

/**
 * One client's work in an app that does not hold the CRM (ADR-1766): the client is the CRM's, so
 * this page knows it only by the id and the name its work was filed under. `ClientPosts` reads the
 * same outlet context as on the CRM's page.
 */
export function WorkClient() {
  const { id = "" } = useParams();
  const { data: posts, error } = useApi<Post[]>("/posts");
  if (posts === null) return <div className="pane-in"><div className="absence">{error ?? "Loading the work…"}</div></div>;
  const name = posts.find((p) => p.clientId === id)?.clientName ?? id;
  const client: Client = { id, slug: id, name, domain: "", stage: "active", services: [], contact: { name: "", email: "", role: "" }, notes: [] };
  return (
    <div className="pane-in">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/" className="btn btn-ghost btn-sm">‹ All work</Link>
        <h1 className="page-title truncate">{name}</h1>
      </header>
      <Outlet context={client} />
    </div>
  );
}
