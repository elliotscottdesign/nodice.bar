import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BingoCardsClient from "./BingoCardsClient";

export const metadata = { title: "Bingo cards — No Dice Admin" };

export default function BingoCardsPage() {
  return (
    <>
      <AdminPageHeader
        title="Bingo cards"
        description="Print a batch of random, unique No Dice bingo cards for the night. Pick how many, hit print — they open ready for the printer or Save as PDF."
      />
      <BingoCardsClient />
    </>
  );
}
