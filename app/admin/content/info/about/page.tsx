import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "About page content — No Dice Admin" };

export default function AboutContentPage() {
  return (
    <>
      <AdminPageHeader
        title="About page"
        description="Edit the copy on /about."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/about`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="info.about" previewPath="/about" />
    </>
  );
}
