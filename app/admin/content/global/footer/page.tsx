import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Footer — Plonk Admin" };

export default function FooterContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Site footer"
        description="The dark band at the bottom of every page — brand, venue addresses, socials, copyright. Address lines that start with an em dash (—) render as muted small print."
        action={
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View site ↗
          </a>
        }
      />
      <ContentEditor page="global.footer" previewPath="/" />
    </>
  );
}
