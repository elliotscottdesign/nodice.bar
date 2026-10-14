import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import Link from "next/link";

export const metadata = { title: "Bingo page content — No Dice Admin" };

// The /bingo (Comedy & Bingo) page is edited IN PLACE on the live page rather
// than through the generic <ContentEditor>: its copy is stored in page_content
// under per-key rows (page == the key, e.g. "bingo.event_date"), not a shared
// "bingo" page value, so the standard form would show no fields. In-place
// editing (click any text on /bingo?edit=1) is the supported path — and the
// founder already edits it this way.
export default function BingoContentPage() {
  const btn =
    "rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5";
  return (
    <>
      <AdminPageHeader
        title="Bingo page"
        description="Edit the Comedy & Bingo night page (/bingo). Copy is edited in place — open the page in edit mode and click any text to change it. Images are managed under Galleries."
        action={
          <>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/bingo?edit=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-plonkPink px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-plonkPink/90"
            >
              Edit copy in place ↗
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/bingo`}
              target="_blank"
              rel="noopener noreferrer"
              className={btn}
            >
              View page ↗
            </a>
          </>
        }
      />

      <div className="space-y-6">
        <AdminCard>
          <div className="px-5 py-5">
            <p className="font-display text-lg">How to edit the copy</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-cream/75">
              <li>
                Click <strong>“Edit copy in place ↗”</strong> above — it opens
                /bingo with editing switched on.
              </li>
              <li>
                Click any heading, paragraph, date, prize or running-order line
                and type your change.
              </li>
              <li>
                Saves go live within a minute. This covers the hero kicker &amp;
                title, the event date, prizes, the running order (times + names)
                and everything else on the page.
              </li>
            </ol>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="px-5 py-5">
            <p className="font-display text-lg">Images</p>
            <p className="mt-2 text-sm text-cream/70">
              Upload the header banner and the host / bingo-machine photo
              slider under Galleries.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin/content/galleries/?gallery=hero.bingo"
                className={btn}
              >
                Header image (hero.bingo) ↗
              </Link>
              <Link
                href="/admin/content/galleries/?gallery=bingo.gallery"
                className={btn}
              >
                Photo slider (bingo.gallery) ↗
              </Link>
            </div>
          </div>
        </AdminCard>
      </div>
    </>
  );
}
