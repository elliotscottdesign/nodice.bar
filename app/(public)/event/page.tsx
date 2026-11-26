// /event?o=<id> — the shareable event page. The page itself lives in
// components/EventSharePage.tsx so the 404 page can render it too for short
// links (nodice.bar/<nameofevent>) — see lib/eventSlug.ts.
import EventSharePage from "@/components/EventSharePage";

export default function EventPage() {
  return <EventSharePage />;
}
