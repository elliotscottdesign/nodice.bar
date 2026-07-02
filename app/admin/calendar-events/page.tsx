"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /admin/calendar-events retired 2026-07-02 in favour of the merged
// /admin/events?tab=posters. Old bookmarks land here and get pushed
// to the new URL client-side. Static export means we can't do a
// server redirect, but this achieves the same effect.
export default function LegacyCalendarEventsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/events?tab=posters");
  }, [router]);
  return (
    <p className="px-6 py-10 text-sm text-cream/70">
      Redirecting to the merged Events page…
    </p>
  );
}
