import AdminPageHeader from "@/components/admin/AdminPageHeader";
import TournamentEntriesClient from "./TournamentEntriesClient";

export const metadata = { title: "Tournament entries — No Dice Admin" };

export default function TournamentEntriesPage() {
  return (
    <>
      <AdminPageHeader
        title="Tournament entries"
        description="Paid team sign-ups from /book/tournament. Use 'Copy team names' to paste into the tournament app when the event starts."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/book/tournament`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View public form ↗
          </a>
        }
      />
      <TournamentEntriesClient />
    </>
  );
}
