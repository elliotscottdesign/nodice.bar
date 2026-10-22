"use client";

// /open-decks — public DJ sign-up for FREE 1-hour open-decks slots on No Dice's
// quiet nights (Sun/Tue/Wed). Pick a date → pick a 7/8/9/10pm slot → leave your
// details (name, phone, email, 3 genres, CDJ/vinyl, optional Insta). Reads the
// calendar + submits through the team hub's `open-decks` edge function.
// Bebas Neue (display) + Inter (body) — customer-facing house rule.

import { useEffect, useMemo, useState } from "react";
import {
  loadOpenDecksCalendar,
  submitOpenDeckSignup,
  type OpenDecksCalendar,
  type OpenDeckDate,
} from "@/lib/db/openDecks";

const GENRES = [
  "House", "Techno", "Disco", "Garage", "DnB", "Jungle", "Dubstep",
  "Hip-Hop", "R&B", "Funk", "Soul", "Jazz", "Afrobeat", "Amapiano",
  "Latin", "Dub", "Reggae", "Dancehall", "Breaks", "Ambient", "Trance",
  "Electro", "Indie", "Rock", "Pop", "Bass", "Minimal", "Edits",
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const inputCls =
  "w-full rounded-lg border border-cream/25 bg-ink/60 px-3.5 py-3 text-base text-cream placeholder:text-cream/35 focus:border-plonkTeal focus:outline-none";

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}
function monthKey(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function OpenDecksPage() {
  const [cal, setCal] = useState<OpenDecksCalendar | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [f, setF] = useState({ name: "", phone: "", email: "", instagram: "", format: "" as "" | "cdj" | "vinyl" });
  const [genres, setGenres] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadOpenDecksCalendar().then(setCal).catch((e) => setLoadErr(e.message || "Couldn't load the calendar."));
  }, []);

  // Dates you can actually pick (not closed by a booked DJ night, not fully taken).
  const byMonth = useMemo(() => {
    const out: { month: string; dates: OpenDeckDate[] }[] = [];
    for (const d of cal?.dates || []) {
      if (d.closed || d.full) continue;
      const m = monthKey(d.date);
      let grp = out.find((g) => g.month === m);
      if (!grp) { grp = { month: m, dates: [] }; out.push(grp); }
      grp.dates.push(d);
    }
    return out;
  }, [cal]);

  const selectedDate = useMemo(() => cal?.dates.find((d) => d.date === date) || null, [cal, date]);

  function toggleGenre(g: string) {
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : prev.length >= 3 ? prev : [...prev, g]);
  }
  function addCustom() {
    const g = customGenre.trim();
    if (!g || genres.length >= 3 || genres.some((x) => x.toLowerCase() === g.toLowerCase())) { setCustomGenre(""); return; }
    setGenres((prev) => [...prev, g]);
    setCustomGenre("");
  }

  const canSubmit = date && slot && f.name.trim() && f.phone.trim() && f.email.trim() && genres.length === 3 && f.format;

  async function submit() {
    setErr("");
    if (!canSubmit) {
      setErr(genres.length !== 3 ? "Please pick exactly 3 genres." : !f.format ? "Please choose CDJ or vinyl." : "Please fill in your name, phone and email.");
      return;
    }
    setSending(true);
    try {
      await submitOpenDeckSignup({
        date, slot, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(),
        genres, format: f.format as "cdj" | "vinyl", instagram: f.instagram.trim() || undefined,
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "That didn't go through — try again.");
      // The slot may have just been taken — refresh the calendar so it updates.
      loadOpenDecksCalendar().then(setCal).catch(() => {});
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setDone(false); setDate(""); setSlot(""); setGenres([]); setCustomGenre("");
    setF({ name: "", phone: "", email: "", instagram: "", format: "" });
    loadOpenDecksCalendar().then(setCal).catch(() => {});
  }

  const slotLabel = cal?.slots.find((s) => s.start === slot)?.label || "";

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        {/* Header */}
        <p className="font-display text-plonkPink text-xl tracking-[0.18em]">NO DICE · LONDON FIELDS</p>
        <h1 className="font-display text-6xl leading-[0.9] mt-1 sm:text-7xl">WANNA PLAY<br />OPEN DECKS?</h1>
        <p className="mt-4 text-base leading-relaxed text-creamDim max-w-prose">
          Free 1-hour slots on our open-decks nights. Grab a date and a time below, bring a USB or your records, and come play. We&apos;ll be in touch to lock it in.
        </p>

        {loadErr && <div className="mt-8 rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm">{loadErr}</div>}
        {!cal && !loadErr && <div className="mt-10 text-creamDim">Loading the calendar…</div>}

        {done ? (
          <div className="mt-10 rounded-2xl border border-plonkTeal/40 bg-plonkTeal/5 p-6">
            <h2 className="font-display text-4xl text-plonkTeal">YOU&apos;RE IN 🎧</h2>
            <p className="mt-2 text-base text-cream">
              Thanks {f.name ? "" : ""}— we&apos;ve got your open-decks slot for <strong>{selectedDate?.weekday} {fmtDate(date)}</strong> at <strong>{slotLabel}</strong>. We&apos;ll be in touch. See you on the decks.
            </p>
            <button onClick={reset} className="mt-5 rounded-lg border border-cream/25 px-4 py-2.5 text-sm hover:border-cream/60">Sign up for another slot</button>
          </div>
        ) : cal && byMonth.length === 0 && !loadErr ? (
          <div className="mt-10 rounded-lg border border-cream/15 bg-cream/5 px-4 py-6 text-creamDim">
            No open-decks dates are free right now — check back soon.
          </div>
        ) : cal ? (
          <>
            {/* Step 1 — pick a date */}
            <section className="mt-10">
              <h2 className="font-display text-3xl tracking-wide">1 · PICK A NIGHT</h2>
              {byMonth.map((grp) => (
                <div key={grp.month} className="mt-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-creamDim">{grp.month}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {grp.dates.map((d) => {
                      const active = d.date === date;
                      return (
                        <button
                          key={d.date}
                          onClick={() => { setDate(d.date); setSlot(""); setErr(""); }}
                          className={`rounded-xl border px-3.5 py-2.5 text-left transition ${active ? "border-plonkPink bg-plonkPink/15" : "border-cream/20 bg-cream/5 hover:border-cream/50"}`}
                        >
                          <span className="block font-display text-2xl leading-none">{fmtDate(d.date)}</span>
                          <span className="block text-xs uppercase tracking-wide text-creamDim mt-0.5">{d.weekday}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            {/* Step 2 — pick a slot */}
            {selectedDate && (
              <section className="mt-10">
                <h2 className="font-display text-3xl tracking-wide">2 · PICK A TIME</h2>
                <p className="mt-1 text-sm text-creamDim">{selectedDate.weekday} {fmtDate(date)} · one-hour sets</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {selectedDate.slots.map((s) => {
                    const active = s.start === slot;
                    return (
                      <button
                        key={s.start}
                        disabled={s.taken}
                        onClick={() => { setSlot(s.start); setErr(""); }}
                        className={`rounded-xl border px-3 py-3 font-display text-2xl transition ${s.taken ? "cursor-not-allowed border-cream/10 bg-cream/[0.03] text-cream/25" : active ? "border-plonkPink bg-plonkPink/15" : "border-cream/20 bg-cream/5 hover:border-cream/50"}`}
                      >
                        {s.label}
                        {s.taken && <span className="block text-[10px] font-body tracking-wide">TAKEN</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Step 3 — your details */}
            {selectedDate && slot && (
              <section className="mt-10">
                <h2 className="font-display text-3xl tracking-wide">3 · YOUR DETAILS</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-creamDim">DJ name</label>
                    <input className={inputCls} value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} placeholder="What should we put on the poster?" maxLength={80} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-creamDim">Phone</label>
                      <input className={inputCls} value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" placeholder="07…" maxLength={40} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-creamDim">Email</label>
                      <input className={inputCls} value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} inputMode="email" placeholder="you@email.com" maxLength={120} />
                    </div>
                  </div>

                  {/* Genres — exactly 3 */}
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-creamDim">
                      Your 3 genres <span className="text-cream/40">· {genres.length}/3</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GENRES.map((g) => {
                        const on = genres.includes(g);
                        const dim = !on && genres.length >= 3;
                        return (
                          <button key={g} type="button" onClick={() => toggleGenre(g)} disabled={dim}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-plonkTeal bg-plonkTeal/20 text-cream" : dim ? "cursor-not-allowed border-cream/10 text-cream/25" : "border-cream/25 hover:border-cream/60"}`}>
                            {g}
                          </button>
                        );
                      })}
                    </div>
                    {/* Custom genre */}
                    <div className="mt-2 flex gap-2">
                      <input className={inputCls + " flex-1"} value={customGenre} onChange={(e) => setCustomGenre(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                        placeholder="Something else? Type it and add" maxLength={24} disabled={genres.length >= 3} />
                      <button type="button" onClick={addCustom} disabled={genres.length >= 3 || !customGenre.trim()}
                        className="rounded-lg border border-cream/25 px-4 text-sm hover:border-cream/60 disabled:opacity-40">Add</button>
                    </div>
                    {genres.some((g) => !GENRES.includes(g)) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {genres.filter((g) => !GENRES.includes(g)).map((g) => (
                          <button key={g} type="button" onClick={() => toggleGenre(g)} className="rounded-full border border-plonkTeal bg-plonkTeal/20 px-3 py-1.5 text-sm">{g} ✕</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Format */}
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-creamDim">Playing on</label>
                    <div className="flex gap-2">
                      {([["cdj", "CDJs / USB"], ["vinyl", "Vinyl"]] as const).map(([k, lbl]) => (
                        <button key={k} type="button" onClick={() => setF((p) => ({ ...p, format: k }))}
                          className={`flex-1 rounded-lg border px-4 py-3 font-display text-2xl transition ${f.format === k ? "border-plonkPink bg-plonkPink/15" : "border-cream/25 hover:border-cream/60"}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instagram (optional) */}
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-creamDim">Instagram <span className="text-cream/40">· optional</span></label>
                    <input className={inputCls} value={f.instagram} onChange={(e) => setF((p) => ({ ...p, instagram: e.target.value }))} placeholder="@you or a link" maxLength={200} />
                  </div>

                  {err && <div className="rounded-lg border border-plonkPink/40 bg-plonkPink/10 px-4 py-3 text-sm">{err}</div>}

                  <button onClick={submit} disabled={sending}
                    className="w-full rounded-xl bg-plonkPink py-4 font-display text-3xl tracking-wide text-cream transition hover:brightness-110 disabled:opacity-60">
                    {sending ? "SENDING…" : "SIGN ME UP"}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
