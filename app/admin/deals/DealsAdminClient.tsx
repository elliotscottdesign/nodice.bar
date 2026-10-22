"use client";

// Dedicated DEALS admin — "its own page of parameters" for a drinks deal, kept
// separate from the busy event form. Deals are still stored on the shared
// `events` table (category drink_special / subcategory "Deals") so they keep
// flowing to /events, the drinks-zine cover and the 8-page flyer. This is a
// focused FORM over that shared row — the structural fields live here, and the
// embedded poster maker handles the photo, colour and the generated artwork.
//
// Longer-term: a deal is becoming a first-class entity (it will feed the till),
// so this page is where its parameters grow — inclusions, active windows, till
// mapping — without bloating the generic event form.

import { useCallback, useEffect, useState } from "react";
import { confirmDialog } from "@/lib/dialog";
import {
  loadAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type DbEvent,
  type NewEvent,
} from "@/lib/db/eventsPlatform";
import EventPosterStudio from "@/components/admin/EventPosterStudio";
import DatePickerInput from "@/components/admin/DatePickerInput";
import Notice from "@/components/Notice";

const inputCls =
  "w-full rounded-md border border-cream/20 bg-ink px-3 py-2 text-sm text-cream placeholder:text-cream/35";

function isDealRow(ev: DbEvent): boolean {
  const subs = (ev.subcategory ?? "").split(",").map((s) => s.trim());
  return ev.category === "drink_special" || subs.includes("Deals");
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function rootIdOf(d: DbEvent): string {
  return d.recurrence_parent_id ?? d.id;
}

// ── Recurrence: none / every day / certain weekdays ──────────────────────────
type Repeat = {
  mode: "none" | "daily" | "days";
  days: number[]; // JS weekday numbers 0=Sun..6=Sat (for "days" mode)
  weeks: string; // how many weeks forward to materialise
};
// Mon-first for the picker; value is the JS getDay() number.
const WEEKDAYS: { n: number; label: string }[] = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
// All the dates a repeat produces, from `fromIso` forward over `weeks` weeks.
function datesFor(fromIso: string, r: Repeat): string[] {
  if (r.mode === "none") return [fromIso];
  const weeks = Math.max(1, Math.min(52, parseInt(r.weeks, 10) || 12));
  const start = new Date(`${fromIso}T00:00:00`);
  const out: string[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (r.mode === "daily" || r.days.includes(d.getDay())) out.push(isoOf(d));
  }
  return out;
}

function RepeatPicker({
  value,
  onChange,
  allowNone = true,
}: {
  value: Repeat;
  onChange: (r: Repeat) => void;
  allowNone?: boolean;
}) {
  const modes: [Repeat["mode"], string][] = [
    ...(allowNone ? ([["none", "Doesn't repeat"]] as [Repeat["mode"], string][]) : []),
    ["daily", "Every day"],
    ["days", "Certain days"],
  ];
  return (
    <div className="space-y-2">
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-cream/15 p-0.5">
        {modes.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...value, mode: m })}
            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
              value.mode === m
                ? "bg-plonkPink text-white"
                : "text-cream/60 hover:text-cream"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {value.mode === "days" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((d) => {
            const on = value.days.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    days: on
                      ? value.days.filter((x) => x !== d.n)
                      : [...value.days, d.n],
                  })
                }
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                  on
                    ? "bg-plonkTeal text-ink"
                    : "border border-cream/20 text-cream/70 hover:bg-cream/5"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      )}
      {value.mode !== "none" && (
        <label className="flex items-center gap-2 text-xs text-cream/55">
          for
          <input
            value={value.weeks}
            onChange={(e) =>
              onChange({ ...value, weeks: e.target.value.replace(/[^0-9]/g, "") })
            }
            inputMode="numeric"
            className="w-16 rounded-md border border-cream/20 bg-ink px-2 py-1 text-sm text-cream"
          />
          weeks
        </label>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DealsAdminClient() {
  const [all, setAll] = useState<DbEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  // null = list; "new" = add; a DbEvent = edit that deal.
  const [editing, setEditing] = useState<DbEvent | "new" | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      setAll(await loadAllEvents());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load deals.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const deals = all.filter(isDealRow);
  // Show each deal once — the series parent / standalone, not every dated child.
  const listed = deals
    .filter((d) => !d.recurrence_parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (editing) {
    return (
      <DealForm
        deal={editing === "new" ? undefined : editing}
        allDeals={deals}
        onDone={() => {
          setEditing(null);
          reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-cream/60">
          Drinks deals — each one makes its poster for the website, the zine cover
          and the printed flyer, all from the fields you fill in here.
        </p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="shrink-0 rounded-full bg-plonkPink px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:brightness-110"
        >
          + Add deal
        </button>
      </div>

      {err && <Notice variant="error">{err}</Notice>}
      {loading ? (
        <p className="text-sm text-cream/50">Loading…</p>
      ) : listed.length === 0 ? (
        <p className="rounded-xl border border-dashed border-cream/20 p-6 text-center text-sm text-cream/50">
          No deals yet. Press <span className="text-plonkPink">+ Add deal</span>.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listed.map((d) => {
            const instances = deals.filter(
              (e) => rootIdOf(e) === rootIdOf(d),
            ).length;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setEditing(d)}
                className="flex gap-3 rounded-xl border border-cream/12 bg-ink/40 p-3 text-left transition hover:border-plonkPink/40"
              >
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded border border-cream/15 bg-ink">
                  {d.poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.poster_url}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-base">{d.name}</p>
                  <p className="text-[11px] uppercase tracking-wider text-cream/45">
                    {d.poster_day_label || "—"}
                    {d.ticket_price != null ? ` · £${d.ticket_price}` : ""}
                  </p>
                  {instances > 1 && (
                    <p className="mt-0.5 text-[10px] text-cream/40">
                      {instances} dates
                    </p>
                  )}
                  {d.poster_subcopy && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-cream/55">
                      {d.poster_subcopy}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-cream/55">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[10px] leading-relaxed text-cream/40">
          {hint}
        </span>
      )}
    </label>
  );
}

function DealForm({
  deal,
  allDeals,
  onDone,
  onCancel,
}: {
  deal?: DbEvent;
  allDeals: DbEvent[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = !!deal;
  const [name, setName] = useState(deal?.name ?? "");
  const [subcopy, setSubcopy] = useState(deal?.poster_subcopy ?? "");
  const [price, setPrice] = useState(
    deal?.ticket_price != null ? String(deal.ticket_price) : "",
  );
  const [dayLabel, setDayLabel] = useState(deal?.poster_day_label ?? "");
  const [startTime, setStartTime] = useState(
    deal?.start_time ? deal.start_time.slice(0, 5) : "",
  );
  const [endTime, setEndTime] = useState(
    deal?.end_time ? deal.end_time.slice(0, 5) : "",
  );
  const [footer, setFooter] = useState(deal?.poster_footer ?? "");
  const [showOnCalendar, setShowOnCalendar] = useState(
    deal?.show_on_events_calendar ?? true,
  );
  // Deals default to a clean calendar card (poster only, no title/description).
  const [showDescription, setShowDescription] = useState(
    deal?.show_description ?? false,
  );

  // Artwork (filled by the poster maker's "Use this artwork").
  const [posterUrl, setPosterUrl] = useState(deal?.poster_url ?? "");
  const [flyerPosterUrl, setFlyerPosterUrl] = useState(
    deal?.flyer_poster_url ?? "",
  );
  const [posterImageUrl, setPosterImageUrl] = useState(
    deal?.poster_image_url ?? "",
  );

  // New-deal scheduling. "days" seeds with the first date's own weekday.
  const [eventDate, setEventDate] = useState(deal?.event_date ?? todayIso());
  const [repeat, setRepeat] = useState<Repeat>({
    mode: "none",
    days: [new Date(`${deal?.event_date ?? todayIso()}T00:00:00`).getDay()],
    weeks: "12",
  });

  // Edit: top up a standing deal's dates so it never silently runs out.
  const [extendOn, setExtendOn] = useState(false);
  const [extendFrom, setExtendFrom] = useState(todayIso());
  const [extendRepeat, setExtendRepeat] = useState<Repeat>({
    mode: "days",
    days: deal
      ? [new Date(`${deal.event_date}T00:00:00`).getDay()]
      : [new Date(`${todayIso()}T00:00:00`).getDay()],
    weeks: "12",
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // The dated rows this deal spans (so an edit updates every instance).
  const seriesIds = deal
    ? allDeals.filter((e) => rootIdOf(e) === rootIdOf(deal)).map((e) => e.id)
    : [];

  function baseFields(): Omit<
    NewEvent,
    | "event_date"
    | "recurrence_type"
    | "recurrence_parent_id"
    | "recurrence_nth"
    | "recurrence_weekday"
  > {
    return {
      name: name.trim(),
      description: subcopy.trim() || null,
      external_link: null,
      poster_url: posterUrl || null,
      flyer_poster_url: flyerPosterUrl || null,
      poster_subcopy: subcopy.trim() || null,
      poster_footer: footer.trim() || null,
      poster_day_label: dayLabel.trim() || null,
      poster_image_url: posterImageUrl || null,
      poster_qr_url: null,
      ticket_price: price ? Number(price) : null,
      category: "drink_special",
      subcategory: "Deals",
      start_time: startTime || null,
      end_time: endTime || null,
      show_on_pool_schedule: false,
      show_on_events_calendar: showOnCalendar,
      show_description: showDescription,
      show_on_bar_page: false,
      requires_ticket: false,
      bookable: false,
      max_attendees: null,
      registration_open: true,
      blocks_table_bookings: false,
    };
  }

  async function save() {
    if (!name.trim()) {
      setErr("Give the deal a name.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const base = baseFields();
      if (editing) {
        // Update every dated instance so the whole run shows the new deal.
        for (const id of seriesIds) await updateEvent(id, base);
        // Optionally top up the run with future weekly dates (so a standing
        // deal doesn't quietly run out), skipping any that already exist.
        if (extendOn) {
          const rootId = rootIdOf(deal!);
          const existing = new Set(
            allDeals
              .filter((e) => rootIdOf(e) === rootId)
              .map((e) => e.event_date),
          );
          for (const dt of datesFor(extendFrom, extendRepeat)) {
            if (existing.has(dt)) continue;
            await createEvent({
              ...base,
              event_date: dt,
              recurrence_type: "none",
              recurrence_parent_id: rootId,
              recurrence_nth: null,
              recurrence_weekday: null,
            });
          }
        }
      } else {
        const dates = datesFor(eventDate, repeat);
        const parent = await createEvent({
          ...base,
          event_date: dates[0],
          recurrence_type: repeat.mode === "none" ? "none" : "weekly",
          recurrence_parent_id: null,
          recurrence_nth: null,
          recurrence_weekday: null,
        });
        for (let i = 1; i < dates.length; i++) {
          await createEvent({
            ...base,
            event_date: dates[i],
            recurrence_type: "none",
            recurrence_parent_id: parent.id,
            recurrence_nth: null,
            recurrence_weekday: null,
          });
        }
      }
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the deal.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!deal) return;
    if (
      !(await confirmDialog(
        `Delete “${deal.name}”${
          seriesIds.length > 1 ? ` and all ${seriesIds.length} dates` : ""
        }? This can't be undone.`,
      ))
    )
      return;
    setBusy(true);
    setErr("");
    try {
      for (const id of seriesIds) await deleteEvent(id);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't delete the deal.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">
          {editing ? `Edit deal — ${deal!.name}` : "Add deal"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold uppercase tracking-wider text-cream/55 hover:text-cream"
        >
          ← Back to deals
        </button>
      </div>

      {err && <Notice variant="error">{err}</Notice>}

      <div className="grid gap-4 rounded-xl border border-cream/12 bg-ink/30 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Deal name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fun of the Fare"
              className={inputCls}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="What's included / info"
            hint="Runs full width on the poster and wraps over as many lines as it needs."
          >
            <textarea
              value={subcopy}
              onChange={(e) => setSubcopy(e.target.value)}
              rows={2}
              placeholder="e.g. 1 round of golf / 3 arcade tokens / 1 house drink"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Price (£)" hint="Sits in the circle on the poster. Leave blank for a free deal.">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="e.g. 11"
            className={inputCls}
          />
        </Field>
        <Field label="Day shown" hint="The bottom line, e.g. TUESDAYS or MON-THURS.">
          <input
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
            placeholder="e.g. Tuesdays"
            className={inputCls}
          />
        </Field>
        <Field label="Start time (optional)">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="End time (optional)">
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Bottom line override"
            hint="Replaces the whole NO DICE · day line, e.g. DEAL OF THE DAY. Press Return for a second line. Leave blank to keep the day line."
          >
            <textarea
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              rows={2}
              placeholder="Usually blank"
              className={inputCls}
            />
          </Field>
        </div>

        {!editing && (
          <>
            <Field label="First date">
              <DatePickerInput
                value={eventDate}
                onChange={setEventDate}
                className={inputCls}
              />
            </Field>
            <Field
              label="Repeats"
              hint="Every day, or pick the weekdays it runs (e.g. Mon–Fri for a weekday happy hour)."
            >
              <RepeatPicker value={repeat} onChange={setRepeat} />
            </Field>
          </>
        )}

        {editing && (
          <div className="sm:col-span-2 rounded-lg border border-cream/12 bg-ink/40 p-3">
            <label className="flex items-center gap-2 text-sm text-cream/80">
              <input
                type="checkbox"
                checked={extendOn}
                onChange={(e) => setExtendOn(e.target.checked)}
                className="accent-plonkPink"
              />
              Keep this deal running — add upcoming dates
            </label>
            {extendOn && (
              <div className="mt-3 space-y-3">
                <Field label="From">
                  <DatePickerInput
                    value={extendFrom}
                    onChange={setExtendFrom}
                    className={inputCls}
                  />
                </Field>
                <RepeatPicker
                  value={extendRepeat}
                  onChange={setExtendRepeat}
                  allowNone={false}
                />
                <p className="text-[11px] text-cream/45">
                  Adds the matching dates from then (skipping any that already
                  exist), so it shows on the calendar going forward.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={showOnCalendar}
              onChange={(e) => setShowOnCalendar(e.target.checked)}
              className="accent-plonkPink"
            />
            Show on the public /events calendar
          </label>
          <label className="flex items-center gap-2 text-sm text-cream/80">
            <input
              type="checkbox"
              checked={showDescription}
              onChange={(e) => setShowDescription(e.target.checked)}
              className="accent-plonkPink"
            />
            Show the title &amp; description under the poster
            <span className="text-[11px] text-cream/40">
              (off = clean, poster only)
            </span>
          </label>
        </div>
      </div>

      {/* Artwork — photo + colour + generate. The copy comes from the fields
          above (hideCopyInputs), so there's nothing to type twice. */}
      <EventPosterStudio
        name={name}
        date={eventDate}
        start={startTime}
        end={endTime}
        isDeal
        exportFlyer
        hideCopyInputs
        defaultSubcopy={subcopy || undefined}
        defaultPrice={price ? `£${price}` : undefined}
        defaultFooter={footer || undefined}
        defaultDayLabel={dayLabel || undefined}
        defaultImageUrl={posterImageUrl || undefined}
        currentPosterUrl={posterUrl || null}
        saveLabel="Use this artwork"
        saveHint="Builds the poster from the fields above. Then press Save deal."
        onSave={(r) => {
          setPosterUrl(r.poster_url);
          if (r.flyer_poster_url !== undefined)
            setFlyerPosterUrl(r.flyer_poster_url ?? "");
          if (r.poster_image_url !== undefined)
            setPosterImageUrl(r.poster_image_url ?? "");
        }}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-cream/10 pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-full bg-plonkTeal px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Saving…" : editing ? "Save deal" : "Create deal"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-full border border-cream/25 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-cream/85 transition hover:bg-cream/5 disabled:opacity-40"
        >
          Cancel
        </button>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="ml-auto rounded-full border border-red-500/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
          >
            Delete deal
          </button>
        )}
      </div>
      {editing && seriesIds.length > 1 && (
        <p className="text-[11px] text-cream/45">
          Saving updates all {seriesIds.length} dates of this deal.
        </p>
      )}
    </div>
  );
}
