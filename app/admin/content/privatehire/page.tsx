import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Private hire content — No Dice Admin" };

export default function PrivateHireContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Private hire"
        description="Edit the copy on /privatehire — venue intro, capacity, features, catering, licences, house rules."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/privatehire`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      {/* Venue scroller photos — the full-width image strip at the top
          of /privatehire (and /xmas), managed as the shared
          `parties.venue` gallery. */}
      <a
        href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/content/galleries?gallery=parties.venue`}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-plonkTeal/40 bg-plonkTeal/10 px-5 py-4 text-sm text-cream transition hover:bg-plonkTeal/20"
      >
        <span>
          <span className="font-bold">🖼 Venue photo scroller</span>
          <span className="mt-0.5 block text-xs text-cream/70">
            Add or reorder the full-width venue photos at the top of this page
            (shared with /xmas). Shows placeholders until you upload.
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
          Manage photos →
        </span>
      </a>

      {/* Single-venue site — the page is now /privatehire and it
          reads the privatehire.hackney.* keys (kept namespaced under
          .hackney so the founder's existing CMS edits carry over
          without a data migration). */}
      <ContentEditor page="privatehire.hackney" previewPath="/privatehire" />
    </>
  );
}
