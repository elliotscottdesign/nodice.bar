import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public anon key — safe to ship in the browser. Real security comes from
// Row Level Security policies on the database. Both can be overridden via
// build-time env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)
// once we want to rotate them, but the defaults work out of the box.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://bieikfwhzkdekojerdqs.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpZWlrZndoemtkZWtvamVyZHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTYxNDQsImV4cCI6MjA5NDA5MjE0NH0.QYdO8mwThnhiK19x_SlxKu15W4yKxMS5Oooxh3rI2zI";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}
