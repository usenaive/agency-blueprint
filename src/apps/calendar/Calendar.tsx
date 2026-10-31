import { CalendarClock, CheckCircle2, FileText } from "lucide-react";
import { useState } from "react";
import type { CalendarEvent } from "../../../seed/events";
import { apiMessage, apiSend, useApi } from "../../api";
import { PageHeader } from "../../components/kit";

const DAY = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const TIME = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
/** A deliverable's day is a calendar day, not an instant: read it as local noon so no zone moves it. */
const dayOf = (start: string) => (start.length === 10 ? new Date(`${start}T12:00:00`) : new Date(start));
const APP_LABEL: Record<string, string> = { crm: "CRM", "seo-geo": "SEO & GEO", ads: "Ads", "landing-page": "Landing page" };

/**
 * The calendar app (ADR-1766): every client meeting and every day a client deliverable is due, by
 * day. Agents put them here with `calendar.create_event`; the work itself stays in its own app.
 */
export function Calendar() {
  const { data: events, error, setData, setError } = useApi<CalendarEvent[]>("/events");
  const [kind, setKind] = useState<"all" | "meeting" | "deliverable">("all");

  const markDone = async (e: CalendarEvent) => {
    try {
      const updated = await apiSend<CalendarEvent>("PATCH", `/events/${e.id}`, { status: "done" });
      setData((events ?? []).map((row) => (row.id === e.id ? updated : row)));
    } catch (err: unknown) {
      setError(apiMessage(err));
    }
  };

  const shown = (events ?? []).filter((e) => e.status !== "cancelled" && (kind === "all" || e.kind === kind));
  const days = [...new Set(shown.map((e) => e.start.slice(0, 10)))];

  return (
    <div className="pane-in">
      <PageHeader
        title="Calendar"
        subtitle="Client meetings and the day each deliverable is due. Agents keep it current; the work itself lives in its own app."
        actions={
          <div className="seg w-fit" role="tablist">
            {(["all", "meeting", "deliverable"] as const).map((k) => (
              <button key={k} type="button" className="seg-item" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
                {k === "all" ? "All" : k === "meeting" ? "Meetings" : "Deliverables"}
              </button>
            ))}
          </div>
        }
      />
      {error ? <p className="notice-fail mb-4">{error}</p> : null}
      {events === null ? <p className="absence">Reading the calendar…</p>
        : days.length === 0 ? <p className="absence">Nothing on the calendar yet. Meetings and due dates appear here as the agents add them.</p>
        : (
          <div className="space-y-5">
            {days.map((day) => (
              <section key={day}>
                <h2 className="mb-2 text-sm font-semibold">{DAY.format(dayOf(day))}</h2>
                <div className="list">
                  {shown.filter((e) => e.start.slice(0, 10) === day).map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
                        {e.kind === "meeting" ? <CalendarClock size={14} /> : <FileText size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${e.status === "done" ? "text-ink-3 line-through" : ""}`}>{e.title}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {e.clientName ?? e.clientId}
                          {e.kind === "meeting" && e.start.length > 10 ? ` · ${TIME.format(new Date(e.start))}${e.end ? `–${TIME.format(new Date(e.end))}` : ""}` : " · due"}
                          {e.where ? ` · ${e.where}` : ""}
                          {e.app ? ` · in ${APP_LABEL[e.app] ?? e.app}` : ""}
                        </span>
                      </div>
                      {e.status === "done" ? (
                        <span className="chip chip-credit">Done</span>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markDone(e)}>
                          <CheckCircle2 size={13} strokeWidth={1.75} /> Mark done
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
    </div>
  );
}
