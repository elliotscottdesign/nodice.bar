import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Borough page content — Plonk Admin" };

export default function VenueBoroughContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Borough Market venue page"
        description="Edit the copy and hero image at /venue/borough-market."
        action={
          <a
            href="/venue/borough-market"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="venue.borough" previewPath="/venue/borough-market" />
    </>
  );
}
