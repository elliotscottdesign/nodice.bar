"use client";

// =============================================================
// Plonk Golf — floating admin bar
// =============================================================
// Appears at the bottom of any public page ONLY when a Supabase
// user is logged in. Gives the admin a one-click jump from the
// public view of any page straight to that page's CMS editor.
//
// Mapping logic lives here (PATH_TO_ADMIN) — keep it in sync if
// you add new public pages or admin content routes.
//
// To hide the bar permanently on this device, click "Hide" — that
// sets a localStorage flag and the bar won't render again until
// the flag is cleared (or the admin clicks the small "Admin"
// re-show pill in the corner).
// =============================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEditModeControls } from "@/lib/editMode";

// Map a public-site pathname to the matching /admin/content/* route.
// Order matters — most-specific patterns first.
function pathToAdminContent(pathname: string): {
  href: string;
  label: string;
} {
  const p = pathname.replace(/\/$/, "") || "/";

  const map: Array<[RegExp, string, string]> = [
    [/^\/$/, "/admin/content/home", "Home"],
    [/^\/venue\/hackney/, "/admin/content/venue/hackney", "Hackney venue"],
    [/^\/venue\/borough-market/, "/admin/content/venue/borough", "Borough venue"],
    [/^\/private-hire\/hackney/, "/admin/content/private-hire/hackney", "Private hire — Hackney"],
    [/^\/private-hire\/borough-market/, "/admin/content/private-hire/borough", "Private hire — Borough"],
    [/^\/private-hire/, "/admin/content/private-hire", "Private hire"],
    [/^\/about/, "/admin/content/info/about", "About"],
    [/^\/contact/, "/admin/content/info/contact", "Contact"],
    [/^\/faqs/, "/admin/content/info/faqs", "FAQs"],
    [/^\/snack-bar/, "/admin/content/info/snack-bar", "Snack Bar"],
    [/^\/terms/, "/admin/content/info/terms", "Terms"],
    [/^\/privacy/, "/admin/content/info/privacy", "Privacy"],
    [/^\/deals/, "/admin", "Deals (not yet in CMS)"],
    [/^\/events/, "/admin", "Events (not yet in CMS)"],
    [/^\/vouchers/, "/admin", "Vouchers (not yet in CMS)"],
    [/^\/book/, "/admin/bookings", "Bookings"],
  ];

  for (const [re, href, label] of map) {
    if (re.test(p)) return { href, label };
  }
  return { href: "/admin", label: "Admin dashboard" };
}

const HIDDEN_KEY = "pg_admin_bar_hidden";

export default function AdminBar() {
  const pathname = usePathname() ?? "/";
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sb = supabase();

    // Initial session check.
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setEmail(data.session?.user?.email ?? null);
      setReady(true);
    });

    // React to login / logout on this tab.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    // Read the "hidden" flag once on mount.
    try {
      if (localStorage.getItem(HIDDEN_KEY) === "1") setHidden(true);
    } catch {
      /* ignore */
    }

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const target = useMemo(() => pathToAdminContent(pathname), [pathname]);
  const { editing, toggle } = useEditModeControls();

  function hide() {
    try {
      localStorage.setItem(HIDDEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }
  function show() {
    try {
      localStorage.removeItem(HIDDEN_KEY);
    } catch {
      /* ignore */
    }
    setHidden(false);
  }
  async function signOut() {
    await supabase().auth.signOut();
    setEmail(null);
  }

  if (!ready || !email) return null;
  // Inside the admin's live-preview iframe — skip the bar so the
  // preview is a clean reflection of what visitors will see.
  if (typeof window !== "undefined" && window.parent !== window) return null;

  // When hidden, show only a small pill in the corner to bring it back.
  if (hidden) {
    return (
      <button
        type="button"
        onClick={show}
        className="fixed bottom-3 right-3 z-[60] rounded-full border border-cream/25 bg-ink/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cream/85 shadow-2xl backdrop-blur hover:bg-ink"
        title="Show admin bar"
      >
        Admin ↑
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Admin tools"
      className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-between gap-3 border-t border-plonkYellow/25 bg-ink/95 px-4 py-2.5 text-xs text-cream/85 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-plonkYellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink">
          Admin
        </span>
        <span className="hidden sm:inline text-cream/65">
          Logged in as <span className="text-cream">{email}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
            editing
              ? "bg-plonkTeal text-ink hover:brightness-110"
              : "bg-plonkYellow text-ink hover:brightness-110"
          }`}
          title="Toggle in-place editing — click any text or image on the page to edit it"
        >
          {editing ? "✓ Editing — click text to edit" : "Edit on page"}
        </button>
        <Link
          href={target.href}
          className="rounded-full bg-plonkPink px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
        >
          Open editor → {target.label}
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-cream/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream hover:bg-cream/5"
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={hide}
          className="rounded-full border border-cream/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/70 hover:bg-cream/5"
          title="Hide for this device — click the small Admin pill in the corner to bring it back."
        >
          Hide
        </button>
        <button
          type="button"
          onClick={signOut}
          className="rounded-full border border-cream/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-cream/70 hover:bg-cream/5"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
