import type { ReactNode } from "react";
import { Link } from "react-router";
import { useApi } from "../api";
import { PageHeader, STAGE_LABEL } from "../components/kit";
import { STAGE_ORDER, TEMPLATE, type Agent, type Client } from "../data";
import { stopLabel, waitingOn, type PlatformSession } from "../platform";

/** `GET /api/context`: the project context (canonical-spec §31.8) plus the install's intake report. */
export interface ProjectContext {
  answers: { key: string; label: string; value: string | string[] }[];
  template: string | null;
  updated_at: string;
}
export interface ContextReply {
  context: ProjectContext;
  intake: { name: string; action: string; id?: string; reason?: string }[];
}

/** A timer as `GET /api/deployments` returns it (canonical-spec §11): the fields the crew list reads. */
export interface Deployment {
  agent_id: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  next_run_at: string | null;
}

const when = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function Card({ title, to, children }: { title: string; to?: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-baseline justify-between text-sm font-medium">
        {title}
        {to ? <Link to={to} className="text-xs font-normal text-ink-2 hover:text-ink">Open →</Link> : null}
      </h2>
      {children}
    </section>
  );
}

const Absent = ({ children }: { children: ReactNode }) => <p className="text-xs text-ink-3">{children}</p>;

/**
 * The first screen under `/app`: what this agency told the platform about itself, what the crew did
 * with it on day one, and what is waiting on the operator now.
 *
 * Every figure is the platform's or the store's own. Without `NAIVE_API_KEY` the platform-backed
 * cards say so and the pipeline card still counts the CRM; with the key but no applied install
 * yet, the context card says that instead of showing a blank form as if answers had been given.
 */
export function Home() {
  const { data: ctx, error: ctxError } = useApi<ContextReply>("/context");
  const { data: sessions, error: sessionError } = useApi<{ data?: PlatformSession[] }>("/sessions");
  const { data: roster } = useApi<{ data?: Agent[] }>("/agents");
  const { data: timers } = useApi<{ data?: Deployment[] }>("/deployments");
  const { data: clients, error: clientError } = useApi<Client[]>("/clients");

  const agents = roster?.data ?? [];
  const names = new Map(agents.map((a) => [a.id, a.name]));
  const allSessions = sessions?.data ?? [];
  const byId = new Map(allSessions.map((s) => [s.id, s]));
  const waiting = waitingOn(allSessions, names);
  const nextFire = new Map<string, Deployment>();
  for (const d of timers?.data ?? []) {
    if (!d.enabled) continue;
    const held = nextFire.get(d.agent_id);
    if (!held || (d.next_run_at ?? "") < (held.next_run_at ?? "")) nextFire.set(d.agent_id, d);
  }
  const notConfigured = ctxError?.startsWith("not configured") ?? false;

  return (
    <div className="pane-in">
      <PageHeader title={TEMPLATE.words.brand} subtitle="What the crew knows, what it did on day one, and what is waiting on you." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Project context">
          {ctx ? (
            <dl className="space-y-3">
              {ctx.context.answers.map((a) => (
                <div key={a.key}>
                  <dt className="text-xs text-ink-2">{a.label}</dt>
                  <dd className="text-sm">{Array.isArray(a.value) ? a.value.join(", ") : a.value}</dd>
                </div>
              ))}
              <div className="text-xs text-ink-3">Template {ctx.context.template ?? "—"} · updated {when(ctx.context.updated_at)}</div>
            </dl>
          ) : ctxError ? (
            <Absent>{notConfigured ? "Not configured — set NAIVE_API_KEY on the dashboard to read this project's setup answers." : ctxError}</Absent>
          ) : (
            <Absent>Reading the project context…</Absent>
          )}
        </Card>

        <Card title="Day one" to="/agents">
          {ctx === null ? (
            <Absent>{ctxError ? "Unknown until the project context can be read." : "Reading the install report…"}</Absent>
          ) : ctx.intake.length === 0 ? (
            <Absent>No intake sessions in this install's report.</Absent>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {ctx.intake.map((line) => {
                const session = line.id ? byId.get(line.id) : undefined;
                return (
                  <li key={line.name} className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{line.name}</span>
                    <span className="text-xs text-ink-2">
                      {session ? stopLabel(session) : line.action === "created" ? (sessionError ?? "created") : line.reason ?? line.action}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Approvals due" to="/approvals">
          {sessions === null ? (
            <Absent>{sessionError ?? "Reading sessions…"}</Absent>
          ) : waiting.length === 0 ? (
            <Absent>Nothing is waiting on you.</Absent>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {waiting.map((row) => (
                <li key={`${row.session.id}:${row.action.tool_call_id}`} className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{row.agent}</span>
                  <span className="font-mono text-xs text-ink-2">{row.action.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Crew" to="/agents">
          {roster === null ? (
            <Absent>{notConfigured ? "Not configured — the roster is the platform's." : "Reading the roster…"}</Absent>
          ) : agents.length === 0 ? (
            <Absent>No agents in this organization yet.</Absent>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {agents.map((a) => {
                const timer = nextFire.get(a.id);
                return (
                  <li key={a.id} className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-ink-2">{timer ? `next ${when(timer.next_run_at)}` : "no timer"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Pipeline" to="/crm">
          {clients === null ? (
            <Absent>{clientError ?? "Reading the CRM…"}</Absent>
          ) : (
            <dl className="grid grid-cols-4 gap-2 text-center">
              {STAGE_ORDER.map((stage) => (
                <div key={stage}>
                  <dd className="text-xl font-semibold">{clients.filter((c) => c.stage === stage).length}</dd>
                  <dt className="text-xs text-ink-2">{STAGE_LABEL[stage]}</dt>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}
