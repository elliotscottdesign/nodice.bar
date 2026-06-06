import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Book page content — No Dice Admin" };

// /book is the four-card landing (Tables / Pool / Parties / Golf).
// Each card has its own group of fields (name, tagline, blurb, image,
// link) seeded into page_content with sort_order spacing so they group
// visually in the ContentEditor form.
export default function BookContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Book Now landing"
        description="Edit the hero copy and the four category cards (Tables / Pool / Parties / Golf) on /book."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/book`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="info.book" previewPath="/book" />
    </>
  );
}
