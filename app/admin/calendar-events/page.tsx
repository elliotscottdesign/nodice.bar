"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /admin/calendar-events retired — first into /admin/events?tab=posters,
// and now (19 Oct 2026) the posters tab is gone too: the one Events editor
// makes any event. Old bookmarks land here and get pushed to /admin/events.
// Static export means we can't do a server redirect, but this is equivalent.
export default function LegacyCalendarEventsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/events");
  }, [router]);
  return (
    <p className="px-6 py-10 text-sm text-cream/70">
      Redirecting to the merged Events page…
    </p>
  );
}
