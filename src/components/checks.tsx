import { CheckCircle2, Circle } from "lucide-react";
import type { ReactNode } from "react";

export interface CrawlCheck { name: string; ok: boolean; detail: string }

/** The public discovery files, fetched the way a crawler would; each passes on its real body. */
export const readCrawlChecks = async (): Promise<CrawlCheck[]> => {
  const checks = await Promise.all([
    fetch("/robots.txt").then(async (res) => ({ name: "robots.txt", ok: res.ok && (await res.text()).includes("Sitemap:"), detail: `${res.status} ${res.headers.get("content-type") ?? ""}` })),
    fetch("/sitemap.xml").then(async (res) => ({ name: "sitemap.xml", ok: res.ok && (await res.text()).includes("<urlset"), detail: `${res.status} ${res.headers.get("content-type") ?? ""}` })),
    fetch("/llms.txt").then(async (res) => ({ name: "llms.txt", ok: res.ok && (await res.text()).startsWith("# "), detail: `${res.status} ${res.headers.get("content-type") ?? ""}` })),
  ]);
  return checks;
};

export const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="panel p-4"><h2 className="text-sm font-semibold">{title}</h2><div className="mt-3">{children}</div></section>
);

export const CheckRow = ({ done, children }: { done: boolean; children: ReactNode }) => (
  <div className="flex items-start gap-2 py-1.5 text-sm">
    {done ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={16} /> : <Circle className="mt-0.5 shrink-0 text-ink-3" size={16} />}
    <span>{children}</span>
  </div>
);
