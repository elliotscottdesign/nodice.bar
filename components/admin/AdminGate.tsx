"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setEmail(data.session?.user?.email ?? "");
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      setEmail(session?.user?.email ?? "");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-cream/60">
        Loading…
      </div>
    );
  }

  if (!signedIn) return <LoginForm />;
  return (
    <>
      <div className="hidden">{email /* expose for debug; not displayed */}</div>
      {children}
    </>
  );
}

export async function logout() {
  await supabase().auth.signOut();
}

// Simple usernames map to real Supabase Auth email addresses behind
// the scenes. The user types "ADMIN" / their password; we send the
// real email + password to Supabase. That way the admin still goes
// through proper authenticated-role auth (so RLS policies on every
// table keep working), but the human only has to remember a
// username, not the underlying email.
//
// To add another login (e.g. a manager), create the Supabase user
// in Authentication → Users, then add a line here:
//   "manager": "manager@plonkgolf.co.uk",
const USERNAME_TO_EMAIL: Record<string, string> = {
  admin: "admin@plonkgolf.co.uk",
};

function resolveEmail(input: string): string {
  const cleaned = input.trim().toLowerCase();
  if (USERNAME_TO_EMAIL[cleaned]) return USERNAME_TO_EMAIL[cleaned];
  // If they typed a full email, accept it as-is (lets the original
  // elliotscottdesign@gmail.com backup login keep working).
  if (cleaned.includes("@")) return cleaned;
  return cleaned;
}

function LoginForm() {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const email = resolveEmail(username);
    const { error } = await supabase().auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) {
      // Mask the Supabase-specific "Invalid login credentials" wording
      // so it doesn't tell an attacker whether the username exists.
      setErr("Username or password is wrong.");
      setBusy(false);
    }
    // On success, onAuthStateChange in the parent flips signedIn -> true.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-cream/10 bg-ink/60 p-8"
      >
        <h1 className="font-display text-2xl">Plonk Admin</h1>
        <p className="mt-1 text-sm text-cream/60">
          Sign in to manage tickets, bookings and the rest.
        </p>

        <label className="mt-6 block text-xs font-bold uppercase tracking-widest text-plonkYellow">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          placeholder="ADMIN"
          className="mt-2 w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-sm text-cream placeholder:text-cream/30 outline-none focus:border-plonkPink"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-widest text-plonkYellow">
          Password
        </label>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border border-cream/15 bg-ink/40 px-4 py-3 text-sm text-cream outline-none focus:border-plonkPink"
        />

        {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

        <button
          type="submit"
          disabled={busy || !username || !pw}
          className="mt-6 w-full rounded-full bg-plonkPink py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-6 text-xs leading-relaxed text-cream/55">
          New users are created in the Supabase dashboard under
          Authentication → Users — then add the username → email mapping
          in <code className="text-cream/85">components/admin/AdminGate.tsx</code>.
        </p>
      </form>
    </div>
  );
}
