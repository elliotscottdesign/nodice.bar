import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Private hire — Borough content" };

export default function PrivateHireBoroughContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Private hire — Borough Market"
        description="Edit the copy on /private-hire/borough-market."
        action={
          <a
            href="/private-hire/borough-market"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="privatehire.borough" previewPath="/private-hire/borough-market" />
    </>
  );
}
