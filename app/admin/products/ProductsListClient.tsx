"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  loadBookableProducts,
  type DbBookableProduct,
} from "@/lib/db/bookableProducts";

// =============================================================
// /admin/products — index of bookable products
// =============================================================
// Lists every row in `bookable_products` (pool, table, future
// surfaces) so the founder picks one to configure. The deep
// editor lives at /admin/products/[id] and handles hours, price
// windows, and date overrides.
// =============================================================

function describe(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

export default function ProductsListClient() {
  const [rows, setRows] = useState<DbBookableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    loadBookableProducts()
      .then((r) => setRows(r))
      .catch((e) => setErr(describe(e, "Failed to load products")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AdminPageHeader
        title="Booking products"
        description="Master config for everything customers can book online — opening hours, prices, deal windows, closed days. The customer-facing booking page reads from these settings."
      />

      {err && (
        <div className="mb-6 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          {err}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-cream/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-cream/60">
          No bookable products configured yet. Run the
          bookable-products migration in Supabase.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((p) => (
            <AdminCard key={p.id}>
              <Link
                href={`/admin/products/${p.id}/`}
                className="block p-5 transition hover:bg-cream/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl">{p.name}</h3>
                    <p className="mt-1 text-xs uppercase tracking-widest text-cream/45">
                      Product ID · {p.id}
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      p.enabled
                        ? "border-plonkTeal/40 bg-plonkTeal/15 text-plonkTeal"
                        : "border-red-400/40 bg-red-400/10 text-red-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        p.enabled ? "bg-plonkTeal" : "bg-red-400"
                      }`}
                    />
                    {p.enabled ? "Open" : "Paused"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-cream/55">
                  <span>
                    Slot length:{" "}
                    <strong className="text-cream/85">
                      {p.slot_duration_minutes} min
                    </strong>
                  </span>
                  <span>
                    Booking length:{" "}
                    <strong className="text-cream/85">
                      {p.min_duration_minutes}–{p.max_duration_minutes} min
                    </strong>
                  </span>
                  <span>
                    Party:{" "}
                    <strong className="text-cream/85">
                      {p.min_party_size}–{p.max_party_size}
                    </strong>
                  </span>
                </div>
                <div className="mt-5 text-xs font-bold uppercase tracking-wider text-plonkTeal">
                  Configure →
                </div>
              </Link>
            </AdminCard>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-xl border border-cream/10 bg-ink/30 p-5 text-sm text-cream/70">
        <p className="text-xs font-bold uppercase tracking-widest text-cream/50">
          About this page
        </p>
        <p className="mt-2">
          New products (e.g. another bookable surface) need a row added in
          Supabase — the public booking pages and Stripe Edge Functions both
          read by product ID, so adding a new one is a code + DB job, not a
          UI-only one.
        </p>
      </div>
    </>
  );
}
