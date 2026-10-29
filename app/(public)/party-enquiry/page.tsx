"use client";

// Public party / event enquiry form. Drops a new enquiry straight into the CRM
// (status 'new', source 'party_form') via the anon insert RLS policy on
// `enquiries`. The team then picks it up on the /admin/enquiries board.

import { useState } from "react";
import PageHero from "@/components/PageHero";
import DatePickerInput from "@/components/admin/DatePickerInput";
import { useImage } from "@/lib/content";
import { submitPublicEnquiry } from "@/lib/db/enquiries";

const inputCls =
  "w-full rounded-md border border-cream/25 bg-ink/60 px-3 py-2.5 text-base text-cream placeholder:text-cream/35 focus:border-plonkTeal focus:outline-none";

export default function PartyEnquiryPage() {
  const [f, setF] = useState({
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    event_type: "",
    party_size: "",
    requested_date: "",
    date_flex: "",
    budget: "",
    notes: "",
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  // Reuse the Parties page's hero image (CMS-managed).
  const heroImage = useImage("privatehire.hackney.hero_image", "");

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.contact_name.trim() || !f.contact_email.trim()) {
      setErr("Please add your name and email so we can get back to you.");
      return;
    }
    setSending(true);
    setErr("");
    try {
      await submitPublicEnquiry({
        ...f,
        party_size: f.party_size ? Number(f.party_size) : null,
        requested_date: f.requested_date || null,
        source: "party_form",
      });
      setDone(true);
    } catch {
      setErr(
        "Something went wrong sending that — please email us at info@nodice.bar.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <PageHero
        eyebrow="Parties & events"
        title="Enquire"
        intro="Tell us what you're planning and we'll get back to you to pencil it in."
        image={heroImage}
      />
      <section className="mx-auto max-w-xl px-4 pb-24">
        {done ? (
          <div className="rounded-2xl border border-plonkTeal/40 bg-plonkTeal/10 p-8 text-center">
            <h2 className="font-display text-2xl text-cream">Got it — thank you!</h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/70">
              Your enquiry is in. We&apos;ll be in touch shortly to pencil in
              your date and sort the details.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {err && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {err}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <L label="Your name *">
                <input
                  value={f.contact_name}
                  onChange={set("contact_name")}
                  className={inputCls}
                  placeholder="Full name"
                />
              </L>
              <L label="Email *">
                <input
                  value={f.contact_email}
                  onChange={set("contact_email")}
                  className={inputCls}
                  placeholder="name@email.com"
                  type="email"
                />
              </L>
              <L label="Phone">
                <input
                  value={f.contact_phone}
                  onChange={set("contact_phone")}
                  className={inputCls}
                  placeholder="07…"
                />
              </L>
              <L label="What's the occasion?">
                <input
                  value={f.event_type}
                  onChange={set("event_type")}
                  className={inputCls}
                  placeholder="Birthday, work do, pool night…"
                />
              </L>
              <L label="How many people?">
                <input
                  value={f.party_size}
                  onChange={set("party_size")}
                  inputMode="numeric"
                  className={inputCls}
                  placeholder="e.g. 12"
                />
              </L>
              <L label="Preferred date">
                <DatePickerInput
                  value={f.requested_date}
                  onChange={(iso) =>
                    setF((p) => ({ ...p, requested_date: iso }))
                  }
                />
              </L>
              <L label="…or flexible">
                <input
                  value={f.date_flex}
                  onChange={set("date_flex")}
                  className={inputCls}
                  placeholder="any Friday in Nov"
                />
              </L>
              <L label="Rough budget">
                <input
                  value={f.budget}
                  onChange={set("budget")}
                  className={inputCls}
                  placeholder="£…"
                />
              </L>
            </div>
            <L label="Anything else?">
              <textarea
                value={f.notes}
                onChange={set("notes")}
                rows={4}
                className={inputCls}
                placeholder="Food, drinks, what you've got in mind…"
              />
            </L>
            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="w-full rounded-full bg-plonkTeal px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send enquiry"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function L({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-cream/55">
        {label}
      </span>
      {children}
    </label>
  );
}
