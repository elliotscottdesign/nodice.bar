import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BingoCallerClient from "./BingoCallerClient";

export const metadata = { title: "Bingo caller — No Dice Admin" };

export default function BingoCallerPage() {
  return (
    <>
      <AdminPageHeader
        title="Bingo caller"
        description="Mark each ball as it's called — the big screen at /bingo-live updates live. Open that on the room's TV; drive it from here."
        action={
          <a
            href="/bingo-live"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#e878f0] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ink hover:bg-[#e878f0]/90"
          >
            Open the big screen ↗
          </a>
        }
      />
      <BingoCallerClient />
    </>
  );
}
