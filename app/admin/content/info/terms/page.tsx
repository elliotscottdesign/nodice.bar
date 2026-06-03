import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Terms content — Plonk Admin" };

export default function TermsContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Terms"
        description="Edit the copy on /terms."
        action={
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="info.terms" previewPath="/terms" />
    </>
  );
}
