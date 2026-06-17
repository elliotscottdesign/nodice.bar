# CLAUDE.md — nodice.bar

This file provides guidance to Claude Code (claude.ai/code) when working in this repo.

## What this is

Next.js 14 customer-site for **No Dice** — the neighbourhood bar at **407 Mentmore Terrace, London Fields, Hackney, E8 3PH** (operating entity **No Dice Hackney Ltd**, a subsidiary of No Dice Bars Ltd). Static export to GitHub Pages on push, served live at **nodice.bar** (apex). `dev.nodice.bar` kept as a staging alias pointing at the same build (see `public/CNAME`).

Stack: Next.js 14 (App Router) · React 18 · Tailwind · Supabase (Postgres + Auth + Edge Functions) · Stripe · Resend.

## Working-style rules (founder-set, treat as load-bearing)

- **The founder is not a coder.** Use plain English in all responses. Never tell them to "find line 42" or paste a diff — when they need to make changes manually, send the full file or the full block they're replacing.
- **Commit + push to main after every change.** "Commit" on this project means commit + push direct to main; the founder is non-technical and wants shipping to be one step.
- **Always send tabs and links.** When a step needs them to open something (Supabase SQL editor, admin URL, GitHub file), include the exact URL — never assume they know how to navigate to it.
- **Be specific in deploy steps.** "Save → Deploy → Manage deployments → ✏️ pencil → Version: New version → Deploy" — never assume the founder remembers the path.
- **Apps Script changes: always send the FULL file.** When a `.gs` file needs editing, paste the entire new file as one "select all → delete → paste → save → deploy new version" block. Never ship diffs for Apps Script.

## UX rules — apply globally to new code

- **Click-to-reveal → auto-scroll.** Whenever a click on a card / row / button reveals a NEW section below (an inline form, a payment widget, an expanded panel — anything that wasn't on screen before the click), the new section MUST smooth-scroll into view automatically. The customer should not have to scroll themselves to find what just appeared.

  Canonical implementation pattern (matches existing usage in `components/MatchSchedule.tsx` and `components/TournamentSchedule.tsx`):

  ```tsx
  import { useEffect, useRef } from "react";

  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const id = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedId]);

  // …
  {selectedId && (
    <div ref={sectionRef} className="scroll-mt-24">
      <RevealedSection />
    </div>
  )}
  ```

  Use `block: "center"` (not `"start"`) — keeps the card the customer tapped partially visible above the new section, anchoring "I picked that, now this opened" psychologically. Wrap the scroll call in `requestAnimationFrame` so the ref is populated before measurement. Add `scroll-mt-24` to the wrapper so anchored scrolling clears the sticky header.

  When this rule does NOT apply: multi-step forms where the next section is already visible on the same page (e.g. `/book/[venue]` — picking a date doesn't reveal new content, it just enables a section that was already laid out below). Auto-scroll mid-form feels jumpy.

- **Cookie/consent defaults: most privacy-preserving.** Decline non-essential cookies unless the customer explicitly opts in.

## Architecture

### Routing
- App Router under `app/`. Customer-facing routes are nested under the `(public)` group so the public layout (header / footer / cookie banner / newsletter popup) wraps them.
- `app/admin/*` is gated by the Supabase magic-link auth + role check in `lib/auth/`. Admin pages are excluded from `app/sitemap.ts` and `app/robots.ts`.

### Data layer
- All Supabase access goes through `lib/db/*` helpers — `eventsPlatform.ts` (events + ticket_types + entries), `tournaments.ts` (pool tournaments), `calendarEvents.ts` (CMS `/events` calendar), `bookings.ts` (bar reservations), etc.
- Components import the typed helpers — never call `supabase.from()` directly from a component.
- The Supabase project ref is **rntcujcpsozvuxvmlejv**. SQL editor: https://supabase.com/dashboard/project/rntcujcpsozvuxvmlejv/sql/new

### RLS status
- Booking tables (`bar_reservations`, `event_entries`, `tournament_entries`) have RLS **disabled** by design — a previous attempt to use RLS-with-anon broke the customer flow. Migration `20260608000002_disable-rls-on-checkout-tables.sql` documents this. Don't re-enable RLS on these tables without a wholesale auth rethink.
- `events` and `ticket_types` — RLS status unknown to most code paths; the SQL Editor runs as `postgres` (BYPASSRLS) so direct inserts work regardless.

### Edge Functions
- Located under `supabase/functions/*`. Each is a Deno module. Notable:
  - `stripe-webhook` — routes Stripe events by `metadata.kind` and fires the matching confirmation email
  - `send-pool-confirmation`, `send-event-entry-confirmation`, `send-welcome-discount` — Resend HTTP API senders
  - `send-booking-reminders` — runs hourly via pg_cron, 22-26h window from now with 4h buffer
- All email templates use the wordmark image from `https://nodice.bar/nodice-wordmark.png` (single source).
- Sender: **No Dice <info@nodice.bar>** · Reply-to: **info@nodice.bar**. (Only `info@` and `elliot@` are real mailboxes — never invent another local-part like `bookings@` or `hello@`, replies bounce.)

### Bookable surfaces ("click → expand below" pattern)
- `components/MatchSchedule.tsx` — `/worldcup` roller deck of fixtures
- `components/MatchCalendar.tsx` — calendar view of the same matches, toggled from MatchSchedule
- `components/TournamentSchedule.tsx` — `/pool` rail of upcoming tournaments
- Each renders a card grid + below it an inline form. They share the **auto-scroll-on-select** behaviour described above.

### Single-page booking forms (NO inline expand)
- `app/(public)/book/pool/page.tsx`
- `app/(public)/book/table/page.tsx`
- `app/(public)/book/[venue]/BookingFlow.tsx`
- These are traditional multi-step forms — date / slot / customer details / Stripe — all sections laid out top-to-bottom. No auto-scroll between steps.

### Styling
- Tailwind only. Design tokens in `tailwind.config.ts` — `plonkPink` (CTA), `plonkTeal` (positive highlight), `plonkYellow` (deals/special), `cream` (text on dark), `ink` (background).
- Fonts: **Bebas Neue** (headings via `font-display`), **Inter** (body). Loaded from Google Fonts in `app/layout.tsx`.
- Match the surrounding component's tone — most use `text-cream/55` for secondary text, `uppercase tracking-widest` for eyebrows, `rounded-full` for pills/CTAs.

### CMS / inline editing
- `lib/content` exposes `useContent(key, fallback)` and `useImage(key, fallback)` — components read editable strings + images by namespaced key (e.g. `worldcup.schedule.eyebrow`).
- `<Editable k="...">{value}</Editable>` wraps inline-editable text. Founder flips Edit mode on the floating `<AdminBar />`.
- Gallery images uploaded via `/admin/content/galleries`.

## Commands

```bash
npm install
npm run dev           # local dev server
npm run build         # static export to out/
npm run preview       # serve out/ locally
```

No test runner / linter / typechecker is wired up — verify with `npm run build` before pushing if you're worried about TS errors.

## Deploy

- `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. No staging.
- Custom domain via `public/CNAME` — set to `nodice.bar` (apex). Site is live.
- `next.config.mjs` exports `output: "export"` for static hosting.
