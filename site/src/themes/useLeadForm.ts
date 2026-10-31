/**
 * The contact form's state and submit, shared by every theme: each theme draws its own form, and all
 * of them post the same lead through `lead.ts`.
 */
import { useEffect, useState, type FormEvent } from "react";
import { referralCode, submitLead, type ContactForm } from "../lead.ts";

const EMPTY: ContactForm = { company: "", website: "", name: "", email: "", services: [], note: "" };

export type LeadState = "idle" | "sending" | "sent" | "offline";

export function useLeadForm() {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState<LeadState>("idle");
  // Remember a referral link's code on arrival, so it survives the visitor reading on before writing.
  useEffect(() => void referralCode(), []);
  const set = (patch: Partial<ContactForm>) => setForm((f) => ({ ...f, ...patch }));
  const toggle = (name: string) =>
    set({ services: form.services.includes(name) ? form.services.filter((s) => s !== name) : [...form.services, name] });
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    setState(await submitLead(form));
  }
  return { form, set, toggle, state, onSubmit };
}
