import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Header — Plonk Admin" };

export default function HeaderContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Site header"
        description="The sticky bar that sits on every page of the public site — logo, nav links, and the Book Now button. Nav links are 'Label | /path' one per line."
        action={
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View site ↗
          </a>
        }
      />
      <ContentEditor page="global.header" previewPath="/" />
    </>
  );
}
