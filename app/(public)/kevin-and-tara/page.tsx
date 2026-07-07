import type { Metadata } from "next";
import WeddingGate from "./WeddingGate";

// Private wedding page — Kevin & Tara, 29 August 2026.
// Unlisted (noindex, not in sitemap, no in-site nav link) AND gated
// behind a passphrase on the invite card. The gate lives in
// WeddingGate.tsx (client) so the metadata export here still runs
// on the server for the `<head>` tags.
export const metadata: Metadata = {
  title: "Kevin & Tara · 29 August 2026 — No Dice",
  description:
    "Kevin & Tara's wedding evening at No Dice, Hackney — 29 August 2026, from 6pm.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function KevinAndTaraWeddingPage() {
  return <WeddingGate />;
}
