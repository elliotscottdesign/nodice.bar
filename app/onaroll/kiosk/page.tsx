import { Suspense } from "react";
import KioskClient from "./KioskClient";

// On A Roll — SELF-SERVE KIOSK (nodice.bar/onaroll/kiosk). A portrait iPad bolted
// to the food van: the customer orders and pays THEMSELVES on a SumUp Solo, with
// zero staff interaction. Standalone (no No Dice header/footer). Reuses the live
// On A Roll menu + stock + open/closed + the kitchen "ready" SMS; the only new
// bit is the portrait, no-scroll, big-touch-tile presentation and the SumUp
// (stubbed) card-present payment. Locked down for unattended kiosk use.
export const metadata = {
  title: "On A Roll — Order here",
  description: "Self-serve ordering kiosk.",
  robots: { index: false, follow: false },   // never indexed — it's a physical till
  // "Add to Home Screen" on the iPad launches this STANDALONE (no Safari address
  // bar / tabs) — i.e. a true fullscreen kiosk. statusBarStyle hides the top chrome.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" as const, title: "On A Roll" },
};

export const viewport = {
  themeColor: "#fdf2e0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,   // kiosk: no pinch-zoom
  viewportFit: "cover" as const,
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fdf2e0" }} />}>
      <KioskClient />
    </Suspense>
  );
}
