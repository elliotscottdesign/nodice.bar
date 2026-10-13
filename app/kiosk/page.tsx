import { Suspense } from "react";
import KioskClient from "../onaroll/kiosk/KioskClient";

// Short alias for the On A Roll self-serve kiosk: nodice.bar/kiosk
// (easier to type into the iPad than /onaroll/kiosk). Renders the exact same
// kiosk. Static export = no server redirects, so this is a real route, not a
// redirect — both URLs serve the identical kiosk.
export const metadata = {
  title: "On A Roll — Order here",
  description: "Self-serve ordering kiosk.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#fdf2e0" }} />}>
      <KioskClient />
    </Suspense>
  );
}
