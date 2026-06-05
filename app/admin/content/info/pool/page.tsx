import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";
import Link from "next/link";

export const metadata = { title: "Pool page content — No Dice Admin" };

export default function PoolContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Pool page"
        description="Edit the copy on /pool. For hero images, use Galleries → 'HERO slider — Pool'."
        action={
          <>
            <Link
              href="/admin/content/galleries/?gallery=hero.pool"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Hero images ↗
            </Link>
            <a
              href="/pool"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
          </>
        }
      />
      <ContentEditor page="info.pool" previewPath="/pool" />
    </>
  );
}
