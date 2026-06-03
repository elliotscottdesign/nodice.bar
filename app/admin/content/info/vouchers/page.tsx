import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Vouchers content — Plonk Admin" };

export default function VouchersContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Vouchers page"
        description="Edit the copy on /vouchers."
        action={
          <a
            href="/vouchers"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="info.vouchers" previewPath="/vouchers" />
    </>
  );
}
