import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";
import Link from "next/link";

export const metadata = { title: "Bar page content — No Dice Admin" };

export default function BarContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Bar page"
        description="Edit the copy on /bar. For images, use Galleries → 'HERO slider — Bar' and 'Bar — Drinks slider'."
        action={
          <>
            <Link
              href="/admin/content/galleries/?gallery=hero.bar"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Hero images ↗
            </Link>
            <Link
              href="/admin/content/galleries/?gallery=bar.drinks_slider"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              Drinks slider ↗
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/bar`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
            >
              View page ↗
            </a>
          </>
        }
      />
      <ContentEditor page="info.bar" previewPath="/bar" />
    </>
  );
}
