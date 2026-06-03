import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Private hire — Hackney content" };

export default function PrivateHireHackneyContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Private hire — Hackney"
        description="Edit the copy on /private-hire/hackney."
        action={
          <a
            href="/private-hire/hackney"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="privatehire.hackney" previewPath="/private-hire/hackney" />
    </>
  );
}
