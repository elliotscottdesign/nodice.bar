# Supabase setup

This folder holds the SQL that builds the Plonk Golf database.

## First run

1. Open the project at https://supabase.com/dashboard
2. Left sidebar → **SQL Editor**
3. Click **New query**
4. Copy + paste the entire contents of [`schema.sql`](./schema.sql) → click **Run** (bottom right)
5. New query again → paste [`seed.sql`](./seed.sql) → **Run**

That's it. The schema is idempotent (`CREATE TABLE IF NOT EXISTS` everywhere), and the seed
uses `ON CONFLICT DO NOTHING`, so both files are safe to re-run if needed.

## What's in here

- `schema.sql` — 13 tables, indexes, an `updated_at` auto-trigger and Row-Level-Security
  policies (anon can read the public catalogue; authenticated users have full access).
- `seed.sql` — sample data mirroring `lib/mockData.ts`: 2 venues, 7 tickets, 5 add-ons,
  opening hours, holiday closures, 2 promo codes, 3 email templates.

## Future migrations

When the schema needs to change, add a new file `migrations/NNN-thing-being-changed.sql`
(NNN = next number) and we'll run it the same way. Keep changes idempotent.
