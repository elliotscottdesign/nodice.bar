"use client";

// Public voucher verify page. The QR on every voucher points here
// (/voucher?c=CODE). The site is a static export, so we read the code from a
// query param (not a dynamic [code] route — unknown ids 404) and ask the
// voucher-lookup edge function for the SAFE, live status + balance. Anyone can
// confirm a voucher is genuine and see what's left on it — that's what makes a
// photocopy worthless.

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import { useImage } from "@/lib/content";
import { lookupVoucher, type VoucherLookup } from "@/lib/db/vouchers";

function money(pence?: number): string {
  if (pence == null) return "—";
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

const STATUS_COPY: Record<string, { label: string; good: boolean }> = {
  active: { label: "Genuine · ready to use", good: true },
  redeemed: { label: "Already fully used", good: false },
  expired: { label: "Expired", good: false },
  cancelled: { label: "Cancelled", good: false },
};

export default function VoucherVerifyPage() {
  const heroImage = useImage("hero.deals", "");
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "missing" } | { kind: "found"; v: VoucherLookup }
  >({ kind: "loading" });

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("c") || "";
    if (!code) {
      setState({ kind: "missing" });
      return;
    }
    lookupVoucher(code)
      .then((v) =>
        v.found ? setState({ kind: "found", v }) : setState({ kind: "missing" }),
      )
      .catch(() => setState({ kind: "missing" }));
  }, []);

  return (
    <main>
      <PageHero
        eyebrow="Voucher"
        title="No Dice"
        intro="Check a No Dice voucher is genuine and see what's left on it."
        image={heroImage}
      />
      <section className="mx-auto max-w-md px-4 pb-24">
        {state.kind === "loading" && (
          <p className="text-sm text-cream/50">Checking…</p>
        )}
        {state.kind === "missing" && (
          <div className="rounded-2xl border border-cream/15 bg-ink/40 p-6 text-center">
            <p className="text-lg font-semibold">We couldn't find that voucher.</p>
            <p className="mt-2 text-sm text-cream/60">
              Check the code, or ask a member of the team.
            </p>
          </div>
        )}
        {state.kind === "found" && (
          <div className="rounded-2xl border border-cream/15 bg-ink/40 p-6">
            {(() => {
              const s = STATUS_COPY[state.v.status ?? ""] ?? {
                label: state.v.status ?? "",
                good: false,
              };
              return (
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                    s.good
                      ? "bg-plonkTeal/15 text-plonkTeal"
                      : "bg-plonkPink/15 text-plonkPink"
                  }`}
                >
                  {s.label}
                </span>
              );
            })()}
            <div className="mt-4 font-mono text-lg tracking-wider text-cream/90">
              {state.v.code}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-cream/45">
                  Original value
                </div>
                <div className="text-2xl font-bold">{money(state.v.value_pence)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-cream/45">
                  Balance left
                </div>
                <div className="text-2xl font-bold">{money(state.v.balance_pence)}</div>
              </div>
            </div>
            {state.v.expires_at && (
              <p className="mt-5 text-xs text-cream/50">
                Valid until{" "}
                {new Date(state.v.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                . To be used in store, in person. On the day it's first used the
                whole value must be spent — no change is carried over.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
