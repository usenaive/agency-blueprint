/**
 * The `/mcp` endpoint: MCP streamable-HTTP is JSON-RPC over POST, so the
 * subset outside agents actually need (initialize, tools/list, tools/call)
 * is implemented by hand — no SDK dependency. Every tool is a thin layer
 * over the same `store.ts` + `proxy.ts` the dashboard uses.
 *
 * Auth: the one bearer the platform mints for the app's agents (`VETTA_MCP_TOKEN`, handed in by the
 * entry point). The platform API key is never an MCP credential. Each app serves only its own
 * tools (`TOOLS_OF`, ADR-1766), which reach agents as `<app>.<tool>`.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { listAgents, type ProxyConfig } from "./proxy.ts";
import { SITE_SECTIONS } from "../site/site.config.ts";
import { ACTIVE_TEMPLATE } from "../templates/active.ts";
import { kindApp, kindsOf, TOOLS_OF, type AppId } from "./apps.ts";
import { clientCrew } from "./crew.ts";
import type { DraftPostInput, EventPatch, Store } from "./store.ts";
import { EVENT_KINDS, EVENT_STATUSES, type EventKind, type EventStatus } from "../seed/events.ts";
import { APP_IDS, type AppId as AnyApp } from "../templates/index.ts";
import type { LeadSource } from "../seed/clients.ts";

/**
 * Constant-time equality for two secrets of any length — the digests are compared, never the
 * strings, so neither the length nor the first differing byte is readable from the timing.
 * Every bearer this app checks goes through here: `/mcp`'s tokens and `/api/*`'s `DASHBOARD_TOKEN`.
 */
export const sameSecret = (a: string, b: string): boolean =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** The token out of an `Authorization: Bearer …` header, or null when there is not one. */
export const bearerOf = (authHeader: string | undefined): string | null =>
  /^Bearer\s+(\S+)$/i.exec(authHeader ?? "")?.[1] ?? null;

/**
 * A PLATFORM ENTRY TICKET: `<expiry-ms>.<base64url HMAC-SHA256>`, keyed by this app's own
 * `DASHBOARD_TOKEN` over `vetta.app-entry.v1:<expiry-ms>` (`canonical-spec §29.7`).
 *
 * The point of the shape is what it is NOT. The operator's browser is handed a ticket and never the
 * token: the ticket is a one-way function of it, so one read out of a log, a history entry or a
 * `Referer` is worth two minutes and cannot be turned back into the bearer this app compares. The
 * expiry rides in the clear because this function has to read it before it can reject a stale one,
 * and inside the MAC because otherwise it would be the one field a holder could edit.
 */
export function ticketMatches(token: string, ticket: string, now: number): boolean {
  const [expiry, mac] = ticket.split(".");
  const expiresAt = Number(expiry);
  if (mac === undefined || !Number.isSafeInteger(expiresAt) || now >= expiresAt) return false;
  return sameSecret(createHmac("sha256", token).update(`vetta.app-entry.v1:${expiresAt}`).digest("base64url"), mac);
}

/** True when the Authorization header carries the platform's token; unset or empty admits nobody. */
export function authorized(authHeader: string | undefined, platformToken?: string): boolean {
  const token = bearerOf(authHeader);
  return token !== null && Boolean(platformToken) && sameSecret(platformToken!, token);
}

interface JsonRpcRequest { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> }

const obj = (props: Record<string, unknown>, required: string[]) =>
  ({ type: "object", properties: props, required }) as const;
const str = (description: string) => ({ type: "string", description }) as const;
const SITE_URL = str("The agency's public site address: the `url` landing-page.get_site answers");

/** The sources an agent may name. `site` and `manual` belong to the two forms, never to an agent. */
/** `site` is the sales seat filing the landing page's lead (ADR-1766); only `manual`, the CRM form's, is never an agent's. */
const AGENT_SOURCES = ["outreach", "network", "referral", "site"] as const satisfies readonly LeadSource[];

export const TOOLS = [
  { name: "list_clients", description: "All CRM clients with their pipeline stage.", inputSchema: obj({}, []) },
  { name: "get_client", description: "One client by id.", inputSchema: obj({ id: str("Client id (cli_…)") }, ["id"]) },
  { name: "create_lead", description: "Add a new lead to the CRM pipeline. Only the name is required: file what you know and leave the rest for the operator. A name alone, filed a second time, returns the name-only record already on the pipeline instead of a second one.", inputSchema: obj({
    name: str("Company name"), domain: str("Company domain, when known"),
    contact_name: str("Contact person, when known"), contact_email: str("Contact email, when known"), contact_role: str("Contact role, when known"),
    note: str("Optional first note"),
    source: { type: "string", enum: AGENT_SOURCES, description: "Where this lead came from: outreach (your own prospecting, the default), network (someone the operator already knows) or referral (an existing client introduced them; give referred_by) or site (a lead from landing-page.list_new_leads; give its ref when it has one)" },
    referred_by: str("For a referral: the id (cli_…) of the client who introduced them"),
    ref: str("A lead from the landing page: the referral code it arrived with (its `ref`), exactly as given"),
  }, ["name"]) },
  { name: "get_client_crew", description: "The team to hire for a client being onboarded: each agent's full declaration (name, instructions, model, tools, budget), named for this client, its browser limited to the client's own site; the agents it already has; and the identity to give each. Hire each listed agent exactly as written; never edit one.", inputSchema: obj({ client: str("Client id (cli_…)") }, ["client"]) },
  { name: "record_onboarding", description: "Record that the client's team is hired, after every agent get_client_crew listed was created: the client becomes active.", inputSchema: obj({
    client: str("Client id (cli_…)"),
    agents: { type: "array", items: { type: "object", properties: { name: { type: "string" }, id: { type: "string" } }, required: ["name", "id"] }, description: "Each agent hired: its name and agt_ id" },
  }, ["client", "agents"]) },
  { name: "get_referral_link", description: "An active client's private referral link to the agency's contact form. Whoever fills the form in through it is filed as a referral from that client, so quote this link exactly; never write one yourself.", inputSchema: obj({ client: str("Client id (cli_…), an active client"), site_url: SITE_URL }, ["client", "site_url"]) },
  { name: "list_referral_ready", description: "The active clients ready to be asked for an introduction right now: with the agency at least 30 days and not asked in the last 90. Each comes with its contact and referral link. Ask only these.", inputSchema: obj({ site_url: SITE_URL }, ["site_url"]) },
  { name: "record_referral_ask", description: "Record that you drafted a referral ask for this client, which starts its 90-day cooldown. Refused, with the reason, for a client list_referral_ready would not name.", inputSchema: obj({ client: str("Client id (cli_…)") }, ["client"]) },
  { name: "advance_pipeline", description: "Move a client to the next pipeline stage.", inputSchema: obj({ id: str("Client id") }, ["id"]) },
  { name: "add_client_note", description: "File a working note on a client — a drafted outreach or follow-up, a call summary, what a proposal is waiting on — for the operator to read on the client's page. Optionally restate what the client is waiting on next.", inputSchema: obj({
    id: str("Client id"), note: str("The note in full — a drafted follow-up goes here verbatim"),
    next_action: str("Optional: what this client is waiting on now, replacing the previous next action"),
  }, ["id", "note"]) },
  { name: "list_posts", description: "This app's queue of work, for one client or all, optionally filtered by state.", inputSchema: obj({
    client: str("Optional client id (cli_…)"), state: str("Optional status filter: pending|ready|approved|posted|rejected"),
  }, []) },
  { name: "create_draft_post", description: "Add a pending draft to this app's queue for a client.", inputSchema: obj({
    client: str("Client id (cli_…), from crm.list_clients"), client_name: str("The client's name, as the CRM has it"),
    title: str("Title"), summary: str("One-line summary"),
    body: str("The draft itself, in full — this is what the operator reads before approving it."),
    kind: str("A kind this app files"), channel: str("blog|linkedin|x"),
    scheduled_for: str("ISO day (YYYY-MM-DD)"),
  }, ["client", "title", "summary", "kind", "channel", "scheduled_for"]) },
  { name: "approve_post", description: "Approve a post for publishing.", inputSchema: obj({ id: str("Post id") }, ["id"]) },
  { name: "schedule_post", description: "Reslot a post on the calendar.", inputSchema: obj({
    id: str("Post id"), date: str("ISO day (YYYY-MM-DD)"),
  }, ["id", "date"]) },
  { name: "get_calendar", description: "Posts for a client within a date range.", inputSchema: obj({
    client: str("Client id"), from: str("ISO day, inclusive"), to: str("ISO day, inclusive"),
  }, ["client", "from", "to"]) },
  { name: "get_site", description: "The agency's public site as it is published: every section, as one record, and its address (`url`).", inputSchema: obj({}, []) },
  { name: "update_site", description: "Replace whole sections of the public site. Each key given replaces that section in full and must keep its shape (read get_site first); the change is live once the operator approves this call. Never invent a result, a number or a client name.", inputSchema: obj({
    site: { type: "object", description: `Sections to replace: any of ${SITE_SECTIONS.join(", ")}.` },
  }, ["site"]) },
  { name: "list_events", description: "The calendar: client meetings and the days client deliverables are due, soonest first. Filter by date range, client or kind.", inputSchema: obj({
    from: str("Optional ISO day, inclusive"), to: str("Optional ISO day, inclusive"), client: str("Optional client id (cli_…)"), kind: str("Optional: meeting|deliverable"),
  }, []) },
  { name: "create_event", description: "Put a client meeting or a deliverable's due date on the calendar. A deliverable names the app that holds the work and its post_ id there. Booking a meeting here sends no invite: draft the invite for the operator to send.", inputSchema: obj({
    kind: str("meeting|deliverable"), title: str("What it is, in a few words"), client: str("Client id (cli_…), from crm.list_clients"), client_name: str("The client's name, as the CRM has it"),
    start: str("ISO day (YYYY-MM-DD) for a deliverable; ISO date-time for a meeting"), end: str("Optional ISO date-time a meeting ends"),
    where: str("Optional: a meeting's link or place"), app: str("A deliverable's app: crm|seo-geo|ads|landing-page"), ref: str("A deliverable's post_ id in that app"), notes: str("Optional notes"),
  }, ["kind", "title", "client", "start"]) },
  { name: "update_event", description: "Reschedule, rename or renote an event, or mark it done or cancelled.", inputSchema: obj({
    id: str("Event id (evt_…)"), title: str("Optional new title"), start: str("Optional new start"), end: str("Optional new end"),
    where: str("Optional new link or place"), notes: str("Optional notes, replacing the old"), status: str("Optional: scheduled|done|cancelled"),
  }, ["id"]) },
  { name: "list_new_leads", description: "Leads from the public contact form not yet filed into the CRM, oldest first. File each with crm.create_lead (passing its ref, when it has one), then mark_lead_filed.", inputSchema: obj({}, []) },
  { name: "mark_lead_filed", description: "Mark a lead filed into the CRM, so it is never listed again. Safe to repeat.", inputSchema: obj({ id: str("Lead id (cli_…), from list_new_leads") }, ["id"]) },
] as const;

/** The tools `app` serves, with the kinds it files named where an agent picks one. */
export function toolsFor(app: AppId) {
  const kinds = kindsOf(app).join("|");
  return TOOLS.filter((tool) => TOOLS_OF[app].includes(tool.name)).map((tool) =>
    tool.name !== "create_draft_post" ? tool : { ...tool, inputSchema: { ...tool.inputSchema, properties: { ...tool.inputSchema.properties, kind: str(kinds) } } });
}

class ToolError extends Error {}
const need = (params: Record<string, unknown>, key: string): string => {
  const value = params[key];
  if (typeof value !== "string" || value === "") throw new ToolError(`${key} is required`);
  return value;
};
const text = (params: Record<string, unknown>, key: string): string =>
  typeof params[key] === "string" ? (params[key] as string) : "";

/** The public site's address an agent read from `landing-page.get_site`; the CRM is not the site, so it cannot know it. */
const siteUrl = (params: Record<string, unknown>): string => {
  const url = need(params, "site_url");
  if (!/^https?:\/\/[^\s/]+/.test(url)) throw new ToolError("site_url must be the address landing-page.get_site answers, like https://agency.example");
  return url.replace(/\/+$/, "");
};

async function callTool(name: string, params: Record<string, unknown>, store: Store, config: ProxyConfig | null, origin: string, app: AppId): Promise<unknown> {
  if (!TOOLS_OF[app].includes(name)) throw new ToolError(`unknown tool: ${name}`);
  switch (name) {
    case "get_referral_link": {
      const id = need(params, "client");
      const site = siteUrl(params);
      const code = store.referralCode(id);
      if (code === null) throw new ToolError("only an active client has a referral link (list_clients shows each client's stage)");
      return { client: id, code, url: `${site}/?ref=${code}#contact` };
    }
    case "list_referral_ready": {
      const site = siteUrl(params);
      return store.referralReady(new Date()).map((c) => ({
        id: c.id, name: c.name, contact: c.contact, referral_link: `${site}/?ref=${store.referralCode(c.id)}#contact`,
      }));
    }
    case "record_referral_ask": {
      const recorded = store.recordReferralAsk(need(params, "client"), new Date());
      if ("refused" in recorded) throw new ToolError(recorded.refused);
      return recorded.client;
    }
    case "list_clients":
      return store.read().clients;
    case "get_client": {
      const client = store.read().clients.find((c) => c.id === need(params, "id"));
      if (!client) throw new ToolError("no such client");
      return client;
    }
    case "create_lead": {
      // A landing-page lead's referral code names the client who sent it; an unknown code is an ordinary site lead.
      const ref = text(params, "ref");
      const referrer = ref === "" ? undefined : store.read().clients.find((c) => c.referralCode === ref);
      const referredBy = text(params, "referred_by") || referrer?.id || "";
      const source = text(params, "source") || (referredBy ? "referral" : ref ? "site" : "outreach");
      if (!(AGENT_SOURCES as readonly string[]).includes(source)) throw new ToolError(`source must be one of ${AGENT_SOURCES.join(", ")}`);
      if (source === "referral" && !store.read().clients.some((c) => c.id === referredBy && c.stage !== "lead" && c.domain !== "")) {
        throw new ToolError("a referral needs referred_by: the id of the existing client (past the lead stage, not the agency itself) who introduced them (list_clients)");
      }
      if (referredBy && source !== "referral") throw new ToolError("referred_by is only for a referral");
      return store.createLead({
        name: need(params, "name"), domain: text(params, "domain"),
        contact: { name: text(params, "contact_name"), email: text(params, "contact_email"), role: text(params, "contact_role") },
        note: typeof params.note === "string" ? params.note : undefined,
        source: source as LeadSource,
        ...(referredBy ? { referredBy } : {}),
      });
    }
    case "advance_pipeline": {
      const client = store.advanceClient(need(params, "id"));
      if (!client) throw new ToolError("no such client");
      return client;
    }
    case "add_client_note": {
      const client = store.addClientNote(need(params, "id"), need(params, "note"),
        typeof params.next_action === "string" && params.next_action !== "" ? params.next_action : undefined);
      if (!client) throw new ToolError("no such client");
      return client;
    }
    case "list_posts": {
      const client = text(params, "client");
      return store.read().posts.filter((p) => (client === "" || p.clientId === client) && (params.state === undefined || p.status === params.state));
    }
    case "create_draft_post": {
      const kind = need(params, "kind");
      if (!ACTIVE_TEMPLATE.kinds.some((k) => k.id === kind)) throw new ToolError(`kind must be one of ${kindsOf(app).join(", ")}`);
      if (kindApp(kind) !== app) throw new ToolError(`kind "${kind}" is filed in ${kindApp(kind)}, not ${app}: use ${kindApp(kind)}.create_draft_post`);
      const clientName = text(params, "client_name");
      const post = store.createDraftPost({
        clientId: need(params, "client"), title: need(params, "title"), summary: need(params, "summary"),
        ...(clientName === "" ? {} : { clientName }),
        body: typeof params.body === "string" && params.body !== "" ? params.body : undefined,
        kind, channel: need(params, "channel") as DraftPostInput["channel"],
        scheduledFor: need(params, "scheduled_for"), agent: "mcp",
      }, app !== "crm");
      if (!post) throw new ToolError("no such client");
      return post;
    }
    case "approve_post": {
      const post = store.updatePost(need(params, "id"), { status: "approved" });
      if (!post) throw new ToolError("no such post");
      return post;
    }
    case "schedule_post": {
      const post = store.updatePost(need(params, "id"), { scheduledFor: need(params, "date") });
      if (!post) throw new ToolError("no such post");
      return post;
    }
    case "get_client_crew": {
      const client = store.read().clients.find((c) => c.id === need(params, "client"));
      if (!client) throw new ToolError("no such client");
      if (config === null) throw new ToolError("this app cannot read the agents yet: the platform has not given it a key");
      const roster = await listAgents(config);
      if (roster === null) throw new ToolError("the agents could not be read just now; try again");
      const crew = clientCrew(client, ACTIVE_TEMPLATE.crew, roster.map((a) => a.name));
      if (!crew.ok) throw new ToolError(crew.reason);
      return { client: client.id, hire: crew.create, already_hired: crew.existing, identity: crew.identity };
    }
    case "record_onboarding": {
      const client = store.onboardClient(need(params, "client"));
      if (!client) throw new ToolError("no such client");
      if (client.stage !== "active") throw new ToolError("a churned client cannot be onboarded");
      return client;
    }
    case "list_events": {
      const from = text(params, "from"), to = text(params, "to"), client = text(params, "client"), kind = text(params, "kind");
      return [...(store.read().events ?? [])]
        .filter((e) => (from === "" || e.start.slice(0, 10) >= from) && (to === "" || e.start.slice(0, 10) <= to)
          && (client === "" || e.clientId === client) && (kind === "" || e.kind === kind))
        .sort((a, b) => a.start.localeCompare(b.start));
    }
    case "create_event": {
      const kind = need(params, "kind");
      if (!(EVENT_KINDS as readonly string[]).includes(kind)) throw new ToolError(`kind must be one of ${EVENT_KINDS.join(", ")}`);
      const start = need(params, "start");
      if (Number.isNaN(Date.parse(start))) throw new ToolError("start must be an ISO day or date-time, like 2026-11-04 or 2026-11-04T15:00:00Z");
      const app = text(params, "app");
      if (app !== "" && !(APP_IDS as readonly string[]).includes(app)) throw new ToolError(`app must be one of ${APP_IDS.join(", ")}`);
      const pick = (k: string) => (text(params, k) === "" ? {} : { [k === "client_name" ? "clientName" : k]: text(params, k) });
      return store.createEvent({
        kind: kind as EventKind, title: need(params, "title"), clientId: need(params, "client"), start,
        ...pick("client_name"), ...pick("end"), ...pick("where"), ...pick("ref"), ...pick("notes"),
        ...(app === "" ? {} : { app: app as AnyApp }),
      });
    }
    case "update_event": {
      const status = text(params, "status");
      if (status !== "" && !(EVENT_STATUSES as readonly string[]).includes(status)) throw new ToolError(`status must be one of ${EVENT_STATUSES.join(", ")}`);
      const patch: EventPatch = {};
      for (const k of ["title", "start", "end", "where", "notes"] as const) if (text(params, k) !== "") patch[k] = text(params, k);
      if (status !== "") patch.status = status as EventStatus;
      const event = store.updateEvent(need(params, "id"), patch);
      if (!event) throw new ToolError("no such event");
      return event;
    }
    case "list_new_leads":
      return store.read().clients.filter((c) => c.stage === "lead" && c.filed !== true);
    case "mark_lead_filed": {
      const lead = store.markLeadFiled(need(params, "id"));
      if (!lead) throw new ToolError("no such lead");
      return { ok: true, id: lead.id };
    }
    case "get_calendar": {
      const client = need(params, "client");
      const from = need(params, "from");
      const to = need(params, "to");
      return store.read().posts.filter((p) => p.clientId === client && p.scheduledFor >= from && p.scheduledFor <= to);
    }
    case "get_site":
      return { ...store.site(), url: origin };
    case "update_site": {
      const patch = params.site;
      if (typeof patch !== "object" || patch === null || Array.isArray(patch)) throw new ToolError("site is required");
      const updated = store.updateSite(patch as Record<string, unknown>);
      if (!updated) throw new ToolError(`site must name only ${SITE_SECTIONS.join(", ")}, each in the shape get_site returns`);
      return updated;
    }
    default:
      throw new ToolError(`unknown tool: ${name}`);
  }
}

const rpcResult = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const rpcError = (id: JsonRpcRequest["id"], code: number, message: string) =>
  ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/**
 * Handles one JSON-RPC message. Answers null for notifications (the caller
 * responds 202 with no body, per the streamable-HTTP transport).
 */
export async function handleMcp(raw: string, store: Store, config: ProxyConfig | null, origin: string, app: AppId): Promise<object | null> {
  let msg: JsonRpcRequest;
  try {
    msg = JSON.parse(raw) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "parse error");
  }
  if (typeof msg.method !== "string") return rpcError(msg.id, -32600, "invalid request");
  if (msg.method.startsWith("notifications/")) return null;
  if (msg.method === "initialize") {
    return rpcResult(msg.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: app, version: "0.0.0" },
    });
  }
  if (msg.method === "tools/list") return rpcResult(msg.id, { tools: toolsFor(app) });
  if (msg.method === "tools/call") {
    const { name, arguments: args } = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    try {
      const result = await callTool(name ?? "", args ?? {}, store, config, origin, app);
      return rpcResult(msg.id, { content: [{ type: "text", text: JSON.stringify(result) }] });
    } catch (err) {
      if (err instanceof ToolError) {
        return rpcResult(msg.id, { content: [{ type: "text", text: err.message }], isError: true });
      }
      throw err;
    }
  }
  return rpcError(msg.id, -32601, "method not found");
}
