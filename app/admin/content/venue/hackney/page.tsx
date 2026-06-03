import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Hackney page content — Plonk Admin" };

export default function VenueHackneyContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Hackney venue page"
        description="Edit the copy and hero image at /venue/hackney."
        action={
          <a
            href="/venue/hackney"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="venue.hackney" previewPath="/venue/hackney" />
    </>
  );
}
