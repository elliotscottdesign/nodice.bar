import { Suspense } from "react";
import ReadyBoard from "./ReadyBoard";

// On A Roll — in-venue "NOW SERVING" board (nodice.bar/onaroll/ready, short: /ready).
// A locked LANDSCAPE iPad mounted in the bar: red-on-black, shows which order number
// is up + the customer's first name, so people with no signal know when to collect.
export const metadata = {
  title: "On A Roll — Orders Ready",
  description: "Live order-ready board.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" as const, title: "Orders Ready" },
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#000" }} />}>
      <ReadyBoard />
    </Suspense>
  );
}
