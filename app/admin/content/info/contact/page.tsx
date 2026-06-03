import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Contact page content — Plonk Admin" };

export default function ContactContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Contact page"
        description="Edit the copy on /contact."
        action={
          <a
            href="/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="info.contact" previewPath="/contact" />
    </>
  );
}
