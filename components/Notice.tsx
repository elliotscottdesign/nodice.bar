import type { ReactNode } from "react";

// =============================================================
// Notice — the ONE warning / error / info / success banner used
// across the whole site. One look everywhere.
//
// The house standard (set by the founder, 2026-10-12) is the
// Calendar Posters tab's error box: a full-width, rounded box with
// a coloured border, a faint tint of the same colour behind it, and
// text in that colour. `error` is the No Dice wordmark red
// (plonkPink #DA1B33); the other variants keep the exact same
// geometry so every banner reads as one family.
//
// Usage:
//   {err && <Notice variant="error">{err}</Notice>}
//   {msg && <Notice variant="success">Saved.</Notice>}
//   <Notice variant="warning">Heads up…</Notice>
//
// `className` is merged last, so call sites can add spacing
// (e.g. "mx-6 mb-4") without changing the look.
// =============================================================

export type NoticeVariant = "error" | "warning" | "info" | "success";

const BASE =
  "rounded-lg border px-4 py-3 text-sm leading-relaxed";

const VARIANT: Record<NoticeVariant, string> = {
  // Brand red — the founder's chosen standard.
  error: "border-plonkPink/40 bg-plonkPink/10 text-plonkPink",
  // Amber — already the codebase's warning tone.
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  // Neutral cream — quiet, informational.
  info: "border-cream/20 bg-cream/5 text-cream",
  // Brand teal — positive confirmation.
  success: "border-plonkTeal/40 bg-plonkTeal/10 text-plonkTeal",
};

export default function Notice({
  variant = "error",
  children,
  className = "",
}: {
  variant?: NoticeVariant;
  children: ReactNode;
  className?: string;
}) {
  // error / warning are announced to screen readers; info / success
  // are passive status updates.
  const role = variant === "error" || variant === "warning" ? "alert" : "status";
  return (
    <div
      role={role}
      className={`${BASE} ${VARIANT[variant]}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
