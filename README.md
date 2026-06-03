# Plonk Golf — Website & Booking System

New plonkgolf.co.uk: a single Next.js 14 app that handles the marketing site **and** a custom booking system to replace Design My Night.

Built for elliotscottdesign / Plonk Golf Ltd.

## Stack

- **Next.js 14** (App Router, TypeScript) — pages + API routes
- **Tailwind CSS** — styling
- **Vercel** — hosting & auto-deploy
- **Supabase Postgres** — bookings, slots, products, vouchers, codes _(to be wired)_
- **Stripe Checkout** — payments with Link built-in _(to be wired)_
- **Resend** — transactional email _(to be wired)_

## Status

Day 1 — scaffold + scraped content + placeholder homepage. Booking flow, admin
panel, payments, and email are not yet built.

See `scrape-archive/` (gitignored) for the original plonkgolf.co.uk HTML and
images that informed this rebuild.

## Local dev (for future, once Node is installed)

```bash
npm install
npm run dev
```

The user does not currently run this locally — every push deploys via Vercel to
a preview URL.
