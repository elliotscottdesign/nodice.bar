// Tiny formatting helpers used across admin pages and the public site.

export const fmtMoney = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Render a YYYY-MM-DD date string with a full label, no time-of-day arithmetic.
export const fmtIsoDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// "PT5M" -> "5 min" style helpers can live here as they crop up.
