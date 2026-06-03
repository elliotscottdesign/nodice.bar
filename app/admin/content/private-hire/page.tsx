import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Private hire content — Plonk Admin" };

export default function PrivateHireContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Private hire — overview"
        description="Edit the copy on /private-hire."
        action={
          <a
            href="/private-hire"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="privatehire" previewPath="/private-hire" />
    </>
  );
}
