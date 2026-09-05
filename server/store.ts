/**
 * The dashboard's local file store: CRM clients and the content queue persist
 * as one JSON file under `data/`. Deliberately the least storage that works —
 * the upgrade path is the platform app database, noted in the README.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { STAGE_ORDER, type Client, type PipelineStage } from "../seed/clients.ts";
import type { Post, PostStatus } from "../seed/posts.ts";
import { ACTIVE_TEMPLATE } from "../templates/active.ts";

/** A minted MCP credential: only the SHA-256 hash of the token is kept. */
export interface McpToken {
  id: string;
  name: string;
  hash: string;
  createdAt: string;
}

export interface StoreState {
  clients: Client[];
  posts: Post[];
  mcpTokens?: McpToken[];
}

export interface LeadInput {
  name: string;
  domain: string;
  contact: { name: string; email: string; role: string };
  services?: string[];
  note?: string;
}

export interface DraftPostInput {
  clientId: string;
  title: string;
  summary: string;
  /** The draft itself. Absent when the agent filed only a line about it. */
  body?: string;
  kind: Post["kind"];
  channel: Post["channel"];
  scheduledFor: string;
  agent?: string;
}

export interface PostPatch {
  status?: PostStatus;
  rejectedReason?: string;
  /** ISO day (YYYY-MM-DD) — reslots the piece on the calendar. */
  scheduledFor?: string;
}

export interface Store {
  read(): StoreState;
  createLead(input: LeadInput): Client;
  createDraftPost(input: DraftPostInput): Post | null;
  mcpTokens(): McpToken[];
  addMcpToken(name: string, hash: string): McpToken;
  removeMcpToken(id: string): boolean;
  advanceClient(id: string): Client | null;
  /** Graduates the client to active and stamps the onboarding time; idempotent. */
  onboardClient(id: string): Client | null;
  updatePost(id: string, patch: PostPatch): Post | null;
}

/**
 * The active template's demo agency, for the local file store only (`openStore`). It never reaches
 * a deployment and never reaches the client bundle: seed rows are the template's sample, not the
 * operator's data, and a deployed dashboard that showed them would be presenting fiction as the
 * customer's CRM.
 */
export const seedState = (): StoreState => ({
  clients: structuredClone(ACTIVE_TEMPLATE.seed.clients as Client[]),
  posts: structuredClone(ACTIVE_TEMPLATE.seed.posts as Post[]),
});

/** What a fresh **deployed** document is created with: nothing, because nothing has happened yet. */
export const emptyState = (): StoreState => ({ clients: [], posts: [] });

/** The stage after `stage` on the happy path; churned only ever by hand. */
const next = (stage: PipelineStage): PipelineStage | null => {
  const candidate = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
  return candidate === undefined || candidate === "churned" ? null : candidate;
};

/** Opens (and on first run seeds) the JSON store at `file`. */
export function openStore(file: string): Store {
  let state: StoreState;
  try {
    state = JSON.parse(readFileSync(file, "utf8")) as StoreState;
  } catch {
    state = seedState();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
  }
  return openStoreOver(state, (next) => writeFileSync(file, JSON.stringify(next, null, 2)));
}

/**
 * The store's behaviour over a state that is already in hand, with persistence injected.
 *
 * The file store above is one caller; the deployed app's is the other — a serverless request has
 * no durable disk, so it loads the document from the app database, runs exactly this logic, and
 * writes the document back (`api/app` in the deploy tree). Keeping one implementation is why
 * `routes.ts` and every screen behave identically in both.
 */
export function openStoreOver(state: StoreState, persist: (state: StoreState) => void): Store {
  const save = () => persist(state);

  return {
    read: () => state,
    createLead(input) {
      const slugged = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const client: Client = {
        id: `cli_${randomBytes(4).toString("hex")}`,
        slug: slugged || "client",
        name: input.name,
        domain: input.domain,
        stage: "lead",
        services: input.services ?? [],
        contact: input.contact,
        notes: input.note === undefined ? [] : [input.note],
      };
      state.clients.push(client);
      save();
      return client;
    },
    createDraftPost(input) {
      if (!state.clients.some((c) => c.id === input.clientId)) return null;
      const post: Post = {
        id: `post_${randomBytes(4).toString("hex")}`,
        clientId: input.clientId,
        title: input.title,
        summary: input.summary,
        ...(input.body === undefined ? {} : { body: input.body }),
        kind: input.kind,
        channel: input.channel,
        status: "pending",
        agent: input.agent ?? "mcp",
        scheduledFor: input.scheduledFor,
        hue: Math.floor(Math.random() * 360),
      };
      state.posts.push(post);
      save();
      return post;
    },
    mcpTokens: () => state.mcpTokens ?? [],
    addMcpToken(name, hash) {
      const token: McpToken = { id: `tok_${randomBytes(4).toString("hex")}`, name, hash, createdAt: new Date().toISOString() };
      (state.mcpTokens ??= []).push(token);
      save();
      return token;
    },
    removeMcpToken(id) {
      const before = state.mcpTokens?.length ?? 0;
      state.mcpTokens = (state.mcpTokens ?? []).filter((t) => t.id !== id);
      save();
      return state.mcpTokens.length < before;
    },
    advanceClient(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client) return null;
      const to = next(client.stage);
      if (to === null) return client;
      client.stage = to;
      save();
      return client;
    },
    onboardClient(id) {
      const client = state.clients.find((c) => c.id === id);
      if (!client || client.stage === "churned") return client ?? null;
      client.stage = "active";
      client.onboardedAt ??= new Date().toISOString();
      save();
      return client;
    },
    updatePost(id, patch) {
      const post = state.posts.find((p) => p.id === id);
      if (!post) return null;
      if (patch.status !== undefined) post.status = patch.status;
      if (patch.scheduledFor !== undefined) post.scheduledFor = patch.scheduledFor;
      if (patch.status === "posted") {
        post.postedAt = "just now";
        post.clicks ??= 0;
        post.impressions ??= 0;
      }
      if (patch.status === "rejected") post.rejectedReason = patch.rejectedReason ?? "Rejected by you";
      save();
      return post;
    },
  };
}
