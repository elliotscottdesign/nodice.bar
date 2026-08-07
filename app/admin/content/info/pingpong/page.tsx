import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";
import Link from "next/link";

export const metadata = { title: "Ping Pong page content — No Dice Admin" };

export default function PingPongContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Ping Pong page"
        description="Edit the copy on /pingpong. For the header image, use Galleries → 'hero.pingpong' (falls back to the shipped green artwork)."
        action={
          <>
            <Link
              href="/admin/content/galleries/?gallery=hero.pingpong"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Hero images ↗
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/pingpong`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
          </>
        }
      />
      <ContentEditor page="info.pingpong" previewPath="/pingpong" />
    </>
  );
}
