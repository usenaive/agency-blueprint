import { useApi } from "../api";
import { TEMPLATE, type Agent } from "../data";
import { useClient } from "./ClientWorkspace";

/** The client's own crew, provisioned on the platform at onboarding with names suffixed by the
 * client slug (`<agent>--acme-dental`), which is how one organization hosts many clients'
 * agents. Which crew — or none at all — is the active template's; the roster is the platform's,
 * and it lists every agent this client has, including one a previous template provisioned and the
 * switch kept. Nothing here is a placeholder for one. */
export function ClientAgents() {
  const client = useClient();
  const { data: page, error } = useApi<{ data?: Agent[] }>("/agents");
  const crew = (page?.data ?? []).filter((a) => a.name.endsWith(`--${client.slug}`));

  if (error) return <p className="text-sm text-fail">{error}</p>;
  if (page === null) return <div className="absence">Loading the crew…</div>;
  if (crew.length === 0) {
    return (
      <div className="absence">{TEMPLATE.words.noCrew}</div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {crew.map((a) => (
        <div key={a.id} className="panel p-3">
          <div className="truncate font-mono font-medium">{a.name}</div>
          {a.description ? <p className="mt-2 text-sm text-ink-2">{a.description}</p> : null}
          <div className="mt-3 truncate font-mono text-xs text-ink-3">{a.model ?? a.id}</div>
        </div>
      ))}
    </div>
  );
}
