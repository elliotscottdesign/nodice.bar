import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";
import NavLinksEditor from "@/components/admin/NavLinksEditor";

export const metadata = { title: "Header — No Dice Admin" };

// Two-section layout:
//   1. NavLinksEditor — purpose-built editor for the top nav links
//      (one row per link with Label / URL inputs, reorder, live
//      preview). Saves to the same `header.nav` content key the
//      generic ContentEditor used to surface.
//   2. ContentEditor — covers every other header field (logo image,
//      Book Now button copy, CTA href, etc.).
//
// The nav editor sits above the catch-all so it's the first thing
// the founder sees when they open this page.
export default function HeaderContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Site header"
        description="The sticky bar that sits on every page of the public site — logo, nav links, and the Book Now button."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View site ↗
          </a>
        }
      />
      <div className="space-y-8">
        <NavLinksEditor />
        <ContentEditor page="global.header" previewPath="/" />
      </div>
    </>
  );
}
