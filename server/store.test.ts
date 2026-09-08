import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "../seed/clients";
import type { Post } from "../seed/posts";
import { ACTIVE_TEMPLATE } from "../templates/active";
import { emptyState, openStore, seedState } from "./store";

/**
 * The rows the store starts with are the *active template's* demo seed, so this suite names them
 * by what they are — a lead, an active client, a pending post — and never by an id. An id here
 * would make switching template a code change in the blueprint's own tests, which is exactly what
 * a template being data is supposed to prevent.
 */
const seedClients = ACTIVE_TEMPLATE.seed.clients as Client[];
const seedPosts = ACTIVE_TEMPLATE.seed.posts as Post[];
const clientAt = (stage: Client["stage"]): string => seedClients.find((c) => c.stage === stage)!.id;
const postAt = (status: Post["status"]): string => seedPosts.find((p) => p.status === status)!.id;

const dirs: string[] = [];
const storeFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "sga-store-"));
  dirs.push(dir);
  return join(dir, "store.json");
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("the two starting documents", () => {
  it("gives a deployment nothing and the local file store the demo agency", () => {
    // A deployed dashboard showing the blueprint's sample rows would be presenting fiction as the
    // operator's CRM; an empty board is the truth about an agency that has not started yet.
    expect(emptyState()).toEqual({ clients: [], posts: [] });
    expect(seedState().clients.length).toBeGreaterThan(0);
  });
});

describe("openStore", () => {
  it("seeds clients and posts on first run", () => {
    const store = openStore(storeFile());
    expect(store.read().clients).toHaveLength((ACTIVE_TEMPLATE.seed.clients as unknown[]).length);
    expect(store.read().posts).toHaveLength((ACTIVE_TEMPLATE.seed.posts as unknown[]).length);
  });

  it("creates a lead at the lead stage with a slug derived from the name", () => {
    const store = openStore(storeFile());
    const lead = store.createLead({
      name: "Summit Outdoor Co",
      domain: "summitoutdoor.example",
      contact: { name: "Jordan Lee", email: "jordan@summitoutdoor.example", role: "Site inquiry" },
      services: ["SEO"],
      note: "Inbound from the public site.",
    });
    expect(lead.stage).toBe("lead");
    expect(lead.slug).toBe("summit-outdoor-co");
    expect(store.read().clients.some((c) => c.id === lead.id)).toBe(true);
  });

  it("files a note on a client, restating what it waits on only when told to", () => {
    const file = storeFile();
    const store = openStore(file);
    const id = clientAt("lead");
    const before = store.read().clients.find((c) => c.id === id)!;
    const notes = before.notes.length;
    const nextAction = before.nextAction;
    const noted = store.addClientNote(id, "Follow-up drafted: checking in on the proposal.");
    expect(noted?.notes.at(-1)).toBe("Follow-up drafted: checking in on the proposal.");
    expect(noted?.nextAction).toBe(nextAction);
    expect(store.addClientNote(id, "Replied Tuesday.", "Waiting on their signature")?.nextAction).toBe(
      "Waiting on their signature",
    );
    expect(store.addClientNote("nope", "x")).toBeNull();
    const onDisk = JSON.parse(readFileSync(file, "utf8")) as { clients: { id: string; notes: string[] }[] };
    expect(onDisk.clients.find((c) => c.id === id)?.notes).toHaveLength(notes + 2);
  });

  it("advances a client along the pipeline and persists it", () => {
    const file = storeFile();
    const store = openStore(file);
    const id = clientAt("lead");
    expect(store.advanceClient(id)?.stage).toBe("proposal");
    expect(store.advanceClient(id)?.stage).toBe("active");
    const onDisk = JSON.parse(readFileSync(file, "utf8")) as { clients: { id: string; stage: string }[] };
    expect(onDisk.clients.find((c) => c.id === id)?.stage).toBe("active");
  });

  it("never advances into churned, and answers null for unknown ids", () => {
    const store = openStore(storeFile());
    expect(store.advanceClient(clientAt("active"))?.stage).toBe("active");
    expect(store.advanceClient("cli_missing")).toBeNull();
  });

  it("updates a post's status with the posted/rejected side effects", () => {
    const store = openStore(storeFile());
    const posted = store.updatePost(postAt("approved"), { status: "posted" });
    expect(posted?.postedAt).toBe("just now");
    expect(posted?.clicks).toBe(0);
    const rejected = store.updatePost(postAt("pending"), { status: "rejected" });
    expect(rejected?.rejectedReason).toBe("Rejected by you");
    expect(store.updatePost("post_missing", { status: "ready" })).toBeNull();
  });

  it("reschedules a post without touching its status", () => {
    const store = openStore(storeFile());
    const moved = store.updatePost(postAt("pending"), { scheduledFor: "2025-03-20" });
    expect(moved?.scheduledFor).toBe("2025-03-20");
    expect(moved?.status).toBe("pending");
  });

  it("onboards a client: active, stamped once, churned left alone", () => {
    const store = openStore(storeFile());
    const id = clientAt("lead");
    const onboarded = store.onboardClient(id);
    expect(onboarded?.stage).toBe("active");
    const stamp = onboarded?.onboardedAt;
    expect(stamp).toBeTruthy();
    expect(store.onboardClient(id)?.onboardedAt).toBe(stamp);
    expect(store.onboardClient(clientAt("churned"))?.stage).toBe("churned");
    expect(store.onboardClient("cli_missing")).toBeNull();
  });

  it("reopens from disk rather than reseeding", () => {
    const file = storeFile();
    const id = postAt("pending");
    openStore(file).updatePost(id, { status: "approved" });
    expect(openStore(file).read().posts.find((p) => p.id === id)?.status).toBe("approved");
  });
});
