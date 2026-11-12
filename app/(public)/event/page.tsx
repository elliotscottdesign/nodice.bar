"use client";

// =============================================================
// /event?o=<id> — the shareable page for ANY special event
// =============================================================
// One stable, paste-anywhere link per special event (socials, QR in venue).
// The site is a static export, so the id is read from a query param, NOT a
// dynamic [id] route (those 404 for ids not known at build time). The page
// is generated entirely from the event's own data — poster, title, date/time,
// blurb — on the shared dark brand template, with a ticket-purchase block.
//
// CTA routing (keeps the "special events link out to the organiser" rule):
//   • external organiser link set  → "Get tickets" goes there.
//   • else requires_ticket + price → on-site card purchase (EventTicketBooking
//     → the category-agnostic event-checkout fn), unless sold out.
//   • else                         → just the event info.
// =============================================================

import { useEffect, useState } from "react";
import EventTicketBooking from "@/components/EventTicketBooking";
import { loadShareEvent, type ShareEvent } from "@/lib/db/shareEvent";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// "20:00:00" → "8pm", "20:30:00" → "8:30pm".
function formatTime(hhmmss: string | null): string {
  if (!hhmmss) return "";
  const [h, m] = hhmmss.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ampm}` : `${h12}${ampm}`;
}

function formatPounds(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

const VENUE_ADDRESS =
  "No Dice, Arch 407, Mentmore Terrace, London Fields, Hackney, E8 3PH";

const CATEGORY_EYEBROW: Record<string, string> = {
  dj_night: "DJ · Live music",
  pool_special: "Pool · Special event",
  special_event: "Special event",
  bingo: "Comedy & bingo",
  food_event: "Food night",
  drink_special: "Deal of the day",
};

export default function EventSharePage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "found"; ev: ShareEvent }
  >({ kind: "loading" });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("o") || "";
    if (!id) {
      setState({ kind: "missing" });
      return;
    }
    loadShareEvent(id)
      .then((ev) => setState(ev ? { kind: "found", ev } : { kind: "missing" }))
      .catch(() => setState({ kind: "missing" }));
  }, []);

  if (state.kind === "loading") {
    return (
      <main className="bg-ink">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="text-sm text-cream/50">Loading…</p>
        </div>
      </main>
    );
  }

  if (state.kind === "missing") {
    return (
      <main className="bg-ink">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-4xl uppercase tracking-wider text-cream">
            Event not found
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm text-cream/60">
            This link may be out of date. See what else is on at No Dice.
          </p>
          <a
            href="/events"
            className="mt-8 inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-sm font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
          >
            What&apos;s on →
          </a>
        </div>
      </main>
    );
  }

  const ev = state.ev;
  const eyebrow =
    (ev.subcategory && ev.subcategory.trim()) ||
    (ev.category ? CATEGORY_EYEBROW[ev.category] : "") ||
    "Special event";
  const when = formatDate(ev.event_date);
  const timeRange = [formatTime(ev.start_time), formatTime(ev.end_time)]
    .filter(Boolean)
    .join(" – ");
  const paragraphs = (ev.description || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const soldOut =
    ev.max_attendees != null && ev.paidCount >= ev.max_attendees;
  const canBookOnSite =
    !ev.external_link &&
    ev.requires_ticket &&
    ev.pricePence != null &&
    ev.registration_open &&
    ev.bookable &&
    !soldOut;

  const priceLine =
    ev.pricePence != null
      ? ev.pricePence === 0
        ? "Free entry"
        : `${formatPounds(ev.pricePence)} a ticket`
      : null;

  // DEALS are always a compact pop-up, whatever's stored. Otherwise honour the
  // builder choice (default 'popup').
  const effectiveStyle: "popup" | "page" =
    ev.category === "drink_special" ? "popup" : ev.page_style;

  // Shared ticket / CTA block — identical rule in both layouts: an external
  // organiser link wins, else an on-site purchase, else sold-out / info.
  const ctaBlock = ev.external_link ? (
    <a
      href={ev.external_link}
      target={/^https?:\/\//.test(ev.external_link) ? "_blank" : undefined}
      rel={/^https?:\/\//.test(ev.external_link) ? "noopener noreferrer" : undefined}
      className="inline-flex w-full items-center justify-center rounded-full bg-plonkPink px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-plonkPink/90"
    >
      Get tickets{priceLine && ev.pricePence ? ` · ${formatPounds(ev.pricePence)}` : ""} →
    </a>
  ) : soldOut ? (
    <div className="rounded-2xl border border-cream/15 bg-ink/40 px-6 py-10 text-center">
      <div className="font-display text-3xl uppercase tracking-wider text-cream">
        Sold out
      </div>
      <p className="mx-auto mt-3 max-w-sm text-sm text-cream/60">
        Tickets for this one have gone. See what else is on.
      </p>
      <a
        href="/events"
        className="mt-6 inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-xs font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
      >
        What&apos;s on →
      </a>
    </div>
  ) : canBookOnSite ? (
    <EventTicketBooking
      eventId={ev.id}
      eventName={ev.name}
      pricePence={ev.pricePence as number}
    />
  ) : (
    <div className="rounded-2xl border border-cream/15 bg-ink/40 px-6 py-10 text-center">
      <p className="text-sm text-cream/70">
        {ev.registration_open
          ? "Tickets for this night aren't on sale here yet — check back soon."
          : "Ticket sales for this night are closed."}
      </p>
      <a
        href="/events"
        className="mt-6 inline-block rounded-full border border-plonkPink/50 px-8 py-3 text-xs font-bold uppercase tracking-widest text-plonkPink transition hover:bg-plonkPink/10"
      >
        What&apos;s on →
      </a>
    </div>
  );

  // ── FULL PAGE layout ──────────────────────────────────────────────────────
  // A fuller, long-form face for an event (chosen in the builder) — bigger
  // hero, a details strip, roomy write-up and a prominent ticket block — all
  // from the event's own row, no hand-coded copy. Styled like /comedybingo.
  if (effectiveStyle === "page") {
    const detailRow = (label: string, value: string) => (
      <div className="flex items-baseline justify-between gap-4 border-t border-cream/10 py-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-cream/45">
          {label}
        </span>
        <span className="text-right font-display text-lg uppercase tracking-wider text-cream sm:text-xl">
          {value}
        </span>
      </div>
    );
    return (
      <main className="bg-ink text-cream">
        {/* Big hero poster */}
        {ev.poster_url && (
          <div className="w-full bg-black">
            <div className="mx-auto max-w-2xl px-4 pt-6 sm:pt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ev.poster_url}
                alt={ev.name}
                className="mx-auto h-auto w-full rounded-2xl object-contain"
              />
            </div>
          </div>
        )}

        {/* Title */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-5xl uppercase leading-[1.05] tracking-wide text-cream sm:text-6xl md:text-7xl">
            {ev.name}
          </h1>
          {priceLine && (
            <div className="mt-5 inline-block rounded-full border border-plonkPink/40 bg-plonkPink/10 px-5 py-2 text-sm font-bold uppercase tracking-widest text-plonkPink">
              {priceLine}
            </div>
          )}
        </section>

        {/* Write-up */}
        {paragraphs.length > 0 && (
          <section className="mx-auto max-w-2xl px-6 pt-6">
            <div className="space-y-6 text-lg leading-relaxed text-cream/85">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        {/* Details strip */}
        <section className="mx-auto max-w-2xl px-6 pt-12">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-plonkPink">
            The details
          </div>
          <div className="mt-2">
            {detailRow("When", when)}
            {timeRange ? detailRow("Time", timeRange) : null}
            {priceLine ? detailRow("Price", priceLine) : null}
            {detailRow("Where", "No Dice · London Fields")}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-cream/55">
            {VENUE_ADDRESS}
          </p>
        </section>

        {/* Ticket block */}
        <section className="mx-auto max-w-xl px-6 pb-28 pt-12">{ctaBlock}</section>
      </main>
    );
  }

  // ── COMPACT POP-UP layout (default) ───────────────────────────────────────
  return (
    <main className="bg-ink text-cream">
      {/* Poster — object-contain so a portrait poster is never cropped. */}
      {ev.poster_url && (
        <div className="relative w-full bg-black">
          <div className="mx-auto max-w-lg px-4 pt-8 sm:pt-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ev.poster_url}
              alt={ev.name}
              className="mx-auto h-auto w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Title band */}
      <section className="mx-auto max-w-2xl px-6 pb-2 pt-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-plonkPink">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl uppercase leading-tight tracking-wide text-cream sm:text-5xl">
          {ev.name}
        </h1>
        <div className="mt-4 font-display text-xl uppercase tracking-wider text-cream/90 sm:text-2xl">
          {when}
          {timeRange ? <span className="text-cream/50"> · {timeRange}</span> : null}
        </div>
        {priceLine && (
          <div className="mt-2 text-sm font-bold uppercase tracking-widest text-cream/55">
            {priceLine}
          </div>
        )}
      </section>

      {/* Blurb */}
      {paragraphs.length > 0 && (
        <section className="mx-auto max-w-2xl px-6 pt-6">
          <div className="space-y-4 text-base leading-relaxed text-cream/80">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* Ticket / CTA block */}
      <section className="mx-auto max-w-xl px-6 pb-24 pt-10">{ctaBlock}</section>
    </main>
  );
}
