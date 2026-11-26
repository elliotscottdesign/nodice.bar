// =============================================================
// The site's 404 page — also the fallback for event short links
// =============================================================
// GitHub Pages serves this (out/404.html) for any path with no file. A short
// link to an event added since the last build (nodice.bar/<nameofevent>, see
// lib/eventSlug.ts) lands here, so render the event page: it reads the name
// from the address bar and shows that event, or a plain "page not found".
// The public layout is wrapped in by hand — the root not-found sits outside
// the (public) group, so it would otherwise have no header or footer.
import PublicLayout from "./(public)/layout";
import EventSharePage from "@/components/EventSharePage";

export default function NotFound() {
  return (
    <PublicLayout>
      <EventSharePage notFoundPage />
    </PublicLayout>
  );
}
