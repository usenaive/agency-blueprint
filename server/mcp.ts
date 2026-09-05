/**
 * The `/mcp` endpoint: MCP streamable-HTTP is JSON-RPC over POST, so the
 * subset outside agents actually need (initialize, tools/list, tools/call)
 * is implemented by hand — no SDK dependency. Every tool is a thin layer
 * over the same `store.ts` + `proxy.ts` the dashboard uses.
 *
 * Auth: bearer tokens minted from the Settings screen, kept in the file
 * store as SHA-256 hashes, plus the one the platform mints for the app's
 * own agents (`VETTA_MCP_TOKEN`, handed in by the entry point). The
 * platform API key is never an MCP credential.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { listAgents, proxyFetch, type AgentRow, type ProxyConfig } from "./proxy.ts";
import { ACTIVE } from "../templates/index.ts";
import type { DraftPostInput, Store } from "./store.ts";

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/**
 * Constant-time equality for two secrets of any length — the digests are compared, never the
 * strings, so neither the length nor the first differing byte is readable from the timing.
 * Every bearer this app checks goes through here: `/mcp`'s tokens and `/api/*`'s `DASHBOARD_TOKEN`.
 */
export const sameSecret = (a: string, b: string): boolean =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Mints a new bearer token; only its hash is persisted. */
export function mintToken(store: Store, name: string): { id: string; name: string; token: string; createdAt: string } {
  const token = `mcp_${randomBytes(24).toString("hex")}`;
  const record = store.addMcpToken(name, hashToken(token));
  return { id: record.id, name: record.name, token, createdAt: record.createdAt };
}

/** The token out of an `Authorization: Bearer …` header, or null when there is not one. */
export const bearerOf = (authHeader: string | undefined): string | null =>
  /^Bearer\s+(\S+)$/i.exec(authHeader ?? "")?.[1] ?? null;

/**
 * True when the Authorization header carries a minted, unrevoked token, or
 * the platform token when one was injected (unset or empty disables that path).
 */
export function authorized(store: Store, authHeader: string | undefined, platformToken?: string): boolean {
  const token = bearerOf(authHeader);
  if (token === null) return false;
  if (platformToken && sameSecret(platformToken, token)) return true;
  const hash = hashToken(token);
  return store.mcpTokens().some((t) => sameSecret(t.hash, hash));
}

interface JsonRpcRequest { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> }

const obj = (props: Record<string, unknown>, required: string[]) =>
  ({ type: "object", properties: props, required }) as const;
const str = (description: string) => ({ type: "string", description }) as const;

export const TOOLS = [
  { name: "list_clients", description: "All CRM clients with their pipeline stage.", inputSchema: obj({}, []) },
  { name: "get_client", description: "One client by id.", inputSchema: obj({ id: str("Client id (cli_…)") }, ["id"]) },
  { name: "create_lead", description: "Add a new lead to the CRM pipeline.", inputSchema: obj({
    name: str("Company name"), domain: str("Company domain"),
    contact_name: str("Contact person"), contact_email: str("Contact email"), contact_role: str("Contact role"),
    note: str("Optional first note"),
  }, ["name", "domain", "contact_name", "contact_email", "contact_role"]) },
  { name: "advance_pipeline", description: "Move a client to the next pipeline stage.", inputSchema: obj({ id: str("Client id") }, ["id"]) },
  { name: "list_posts", description: "Content queue for a client, optionally filtered by state.", inputSchema: obj({
    client: str("Client id"), state: str("Optional status filter: pending|ready|approved|posted|rejected"),
  }, ["client"]) },
  { name: "create_draft_post", description: "Add a pending draft to a client's content queue.", inputSchema: obj({
    client: str("Client id"), title: str("Title"), summary: str("One-line summary"),
    body: str("The draft itself, in full — this is what the operator reads before approving it."),
    kind: str(ACTIVE.kinds.map((k) => k.id).join("|")), channel: str("blog|linkedin|x"),
    scheduled_for: str("ISO day (YYYY-MM-DD)"),
  }, ["client", "title", "summary", "kind", "channel", "scheduled_for"]) },
  { name: "approve_post", description: "Approve a post for publishing.", inputSchema: obj({ id: str("Post id") }, ["id"]) },
  { name: "schedule_post", description: "Reslot a post on the calendar.", inputSchema: obj({
    id: str("Post id"), date: str("ISO day (YYYY-MM-DD)"),
  }, ["id", "date"]) },
  { name: "list_agents", description: "Platform agents, optionally only one client's crew.", inputSchema: obj({ client: str("Optional client id") }, []) },
  { name: "start_agent_session", description: "Start a session with a platform agent.", inputSchema: obj({
    agent: str("Agent name"), prompt: str("Opening message"),
  }, ["agent", "prompt"]) },
  { name: "get_calendar", description: "Posts for a client within a date range.", inputSchema: obj({
    client: str("Client id"), from: str("ISO day, inclusive"), to: str("ISO day, inclusive"),
  }, ["client", "from", "to"]) },
] as const;

class ToolError extends Error {}
const need = (params: Record<string, unknown>, key: string): string => {
  const value = params[key];
  if (typeof value !== "string" || value === "") throw new ToolError(`${key} is required`);
  return value;
};

/** The whole roster, cursor followed: a crew on page four is an agent this tool can still start. */
async function platformAgents(config: ProxyConfig | null): Promise<AgentRow[]> {
  if (config === null) throw new ToolError("platform not configured on this server");
  const roster = await listAgents(config);
  if (roster === null) throw new ToolError("platform agents unavailable");
  return roster;
}

async function callTool(name: string, params: Record<string, unknown>, store: Store, config: ProxyConfig | null): Promise<unknown> {
  switch (name) {
    case "list_clients":
      return store.read().clients;
    case "get_client": {
      const client = store.read().clients.find((c) => c.id === need(params, "id"));
      if (!client) throw new ToolError("no such client");
      return client;
    }
    case "create_lead":
      return store.createLead({
        name: need(params, "name"), domain: need(params, "domain"),
        contact: { name: need(params, "contact_name"), email: need(params, "contact_email"), role: need(params, "contact_role") },
        note: typeof params.note === "string" ? params.note : undefined,
      });
    case "advance_pipeline": {
      const client = store.advanceClient(need(params, "id"));
      if (!client) throw new ToolError("no such client");
      return client;
    }
    case "list_posts": {
      const client = need(params, "client");
      return store.read().posts.filter((p) => p.clientId === client && (params.state === undefined || p.status === params.state));
    }
    case "create_draft_post": {
      const post = store.createDraftPost({
        clientId: need(params, "client"), title: need(params, "title"), summary: need(params, "summary"),
        body: typeof params.body === "string" && params.body !== "" ? params.body : undefined,
        kind: need(params, "kind") as DraftPostInput["kind"], channel: need(params, "channel") as DraftPostInput["channel"],
        scheduledFor: need(params, "scheduled_for"), agent: "mcp",
      });
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
    case "list_agents": {
      const agents = await platformAgents(config);
      const client = typeof params.client === "string"
        ? store.read().clients.find((c) => c.id === params.client) : undefined;
      return client === undefined ? agents : agents.filter((a) => a.name.endsWith(`--${client.slug}`));
    }
    case "start_agent_session": {
      const agents = await platformAgents(config);
      const agent = agents.find((a) => a.name === need(params, "agent"));
      if (!agent) throw new ToolError("no such agent");
      const created = await proxyFetch(config!, { method: "POST", path: "/v1/sessions" },
        JSON.stringify({ agent_id: agent.id, message: need(params, "prompt") }));
      if (!created.ok) throw new ToolError("session creation failed");
      return await created.json();
    }
    case "get_calendar": {
      const client = need(params, "client");
      const from = need(params, "from");
      const to = need(params, "to");
      return store.read().posts.filter((p) => p.clientId === client && p.scheduledFor >= from && p.scheduledFor <= to);
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
export async function handleMcp(raw: string, store: Store, config: ProxyConfig | null): Promise<object | null> {
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
      serverInfo: { name: "agency", version: "0.0.0" },
    });
  }
  if (msg.method === "tools/list") return rpcResult(msg.id, { tools: TOOLS });
  if (msg.method === "tools/call") {
    const { name, arguments: args } = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    try {
      const result = await callTool(name ?? "", args ?? {}, store, config);
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
