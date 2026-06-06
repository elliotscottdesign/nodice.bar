import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Plonk page content — No Dice Admin" };

// /plonk is the general contact page in the nav (named PLONK per the
// founder's labelling choice). The admin form below edits the same
// contact fields a typical contact page would.
export default function PlonkContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Plonk page (contact)"
        description="Edit the contact details shown on /plonk. Leave the phone field blank to hide the phone card entirely."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/plonk`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="info.plonk" previewPath="/plonk" />
    </>
  );
}
