import AdminPageHeader from "@/components/admin/AdminPageHeader";

export const metadata = { title: "Christmas content — No Dice Admin" };

// Backend for the /xmas Christmas parties page. The menu ITEMS and
// PRICES are edited in the team hub (team.nodice.bar → 🎄 Xmas tab);
// this page manages the two full-width photo scrollers on /xmas (and
// the shared venue scroller that also appears on /privatehire).
const SCROLLERS: {
  key: string;
  title: string;
  blurb: string;
}[] = [
  {
    key: "parties.venue",
    title: "🖼 Venue scroller",
    blurb:
      "Full-width photos of the space at the top of /xmas (and /privatehire — shared). Upload landscape shots. Shows placeholders until you add photos.",
  },
  {
    key: "xmas.menu",
    title: "🎄 Festive menu scroller",
    blurb:
      "Full-width photos at the top of the Christmas party packages on /xmas. Upload shots of the festive food/menu. Shows placeholders until you add photos.",
  },
];

export default function XmasContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Christmas (/xmas)"
        description="Manage the photo scrollers on the Christmas parties page. Menu items & prices live in the team hub → 🎄 Xmas."
        action={
          <a
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/xmas`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />

      <div className="space-y-3">
        {SCROLLERS.map((s) => (
          <a
            key={s.key}
            href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/admin/content/galleries?gallery=${encodeURIComponent(s.key)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 rounded-xl border border-plonkTeal/40 bg-plonkTeal/10 px-5 py-4 text-sm text-cream transition hover:bg-plonkTeal/20"
          >
            <span>
              <span className="font-bold">{s.title}</span>
              <span className="mt-0.5 block text-xs text-cream/70">{s.blurb}</span>
            </span>
            <span className="shrink-0 rounded-full bg-plonkTeal px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
              Manage photos →
            </span>
          </a>
        ))}
      </div>

      <p className="mt-6 rounded-xl border border-cream/10 bg-ink/40 px-5 py-4 text-xs leading-relaxed text-cream/60">
        Menu <strong>items &amp; prices</strong> on /xmas come from the team hub
        (team.nodice.bar → 🎄 Xmas tab) — editing them there updates the live page
        within a minute. This page only controls the photo scrollers.
      </p>
    </>
  );
}
