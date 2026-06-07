import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";
import Link from "next/link";

export const metadata = { title: "World Cup page content — No Dice Admin" };

export default function WorldCupContentPage() {
  return (
    <>
      <AdminPageHeader
        title="World Cup page"
        description="Edit the copy on /world-cup. For match fixtures, use /admin/events (category 'World Cup — Match'). For hero images, use Galleries → 'HERO slider — World Cup'."
        action={
          <>
            <Link
              href="/admin/events/"
              className="rounded-full border border-plonkTeal/40 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-plonkTeal hover:bg-plonkTeal/10"
            >
              Edit fixtures →
            </Link>
            <Link
              href="/admin/content/galleries/?gallery=hero.worldcup"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Hero images ↗
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/world-cup`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
          </>
        }
      />
      <ContentEditor page="info.worldcup" previewPath="/world-cup" />
    </>
  );
}
