import Link from "next/link";
import type { Metadata } from "next";
import MediaStrip from "@/components/MediaStrip";

// Christmas 2026 — public corporate & party menu (nodice.bar/xmas). Reads the
// SAME live doc the kitchen edits in the On A Roll back end (team.nodice.bar →
// 🎄 Xmas tab): packages + à-la-carte, festively styled on the No Dice bed. When
// the kitchen changes a price/package the page follows within a minute (ISR).
//
// getXmasMenu is a PUBLIC action on the team-hub `menu` edge function — no secret
// needed — so we fetch it straight from that project, whatever the site's own
// Supabase env happens to be.
const MENU_FN = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/menu";

export const revalidate = 60; // refresh the menu at most once a minute

export const metadata: Metadata = {
  title: "Christmas 2026 — Corporate & Party Menus | No Dice",
  description:
    "Christmas parties at No Dice, London Fields. Festive sharing menus and packages for corporate and private celebrations — book direct with the team.",
  alternates: { canonical: "/xmas" },
  openGraph: {
    title: "Christmas 2026 at No Dice — London Fields",
    description:
      "Festive sharing menus and party packages for your Christmas do. Book direct with the team.",
    url: "/xmas",
    type: "website",
  },
};

// ── Costing (mirrors src/kitchen/XmasMenuPanel.jsx exactly) ──────────────────
const num = (v: unknown) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const gcost = (g: any) =>
  num(g?.packSize) > 0 && g?.packPrice !== "" && g?.packPrice != null && g?.qtyUsed !== "" && g?.qtyUsed != null
    ? (num(g.packPrice) / num(g.packSize)) * num(g.qtyUsed)
    : num(g?.cost);
const itemCost = (it: any) => (it?.ingredients || []).reduce((s: number, g: any) => s + gcost(g), 0);
const targetPct = (it: any, settings: any) => num(settings?.targetFoodPct) || num(it?.targetPct) || 0.3;
const sellOf = (it: any, settings: any) =>
  it?.sellOverride !== "" && it?.sellOverride != null
    ? num(it.sellOverride)
    : targetPct(it, settings) > 0
      ? itemCost(it) / targetPct(it, settings)
      : 0;

const gbp = (n: number) => "£" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));

type Pkg = { name: string; pricePerHead: number; blurb: string; items: string[] };
type Ala = { name: string; desc: string; sell: number; board: boolean };

async function getXmas(): Promise<any | null> {
  try {
    const res = await fetch(MENU_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getXmasMenu" }),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.doc || null;
  } catch {
    return null;
  }
}

export default async function XmasPage() {
  const doc = await getXmas();
  const settings = doc?.settings ?? { targetFoodPct: 0.3 };
  const items: any[] = Array.isArray(doc?.items) ? doc.items : [];
  const byId: Record<string, any> = Object.fromEntries(items.map((it) => [it.id, it]));

  const packages: Pkg[] = (Array.isArray(doc?.packages) ? doc.packages : [])
    .filter((p: any) => p?.name)
    .map((p: any) => ({
      name: p.name,
      pricePerHead: num(p.pricePerHead),
      blurb: p.blurb || "",
      items: (p.items || []).map((x: any) => byId[x.itemId]?.name).filter(Boolean),
    }));

  const alacarte: Ala[] = items
    .filter((it) => it?.name)
    .map((it) => ({
      name: it.name,
      desc: it.desc || "",
      sell: sellOf(it, settings),
      board: num(it.portion) === 0,
    }));

  const hasContent = packages.length > 0 || alacarte.length > 0;

  return (
    <main className="bed-hackney">
      {/* Festive ribbon */}
      <div className="h-1.5 w-full bg-gradient-to-r from-nodiceRed via-pong to-nodiceRed" />

      {/* VENUE scroller — full-width, sits at the very top. Blank
          placeholders until the team uploads photos to the shared
          `venue.hackney` gallery (also used on /privatehire). */}
      <div className="pt-20 sm:pt-24">
        <MediaStrip
          galleryKey="parties.venue"
          blankLabel="Venue photo"
          aspect="16 / 9"
          blankCount={6}
        />
      </div>

      {/* HERO */}
      <header className="relative flex min-h-[30vh] flex-col items-center justify-center px-6 pt-8 pb-14 text-center">
        <p className="text-xs font-bold uppercase tracking-eyebrow text-nodiceRed">
          No Dice · London Fields
        </p>
        <h1 className="mt-4 font-display text-5xl leading-tight sm:text-6xl">
          Christmas at No Dice
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-cream/85 sm:text-lg">
          Festive sharing menus and party packages for your Christmas do — corporate
          or private, big group or small. Booze, games and proper food in the heart of
          London Fields.
        </p>
        <div className="mt-7 flex items-center gap-3 text-pongLight" aria-hidden>
          <span className="h-px w-10 bg-pong/60" />
          <span className="text-lg">❄</span>
          <span className="h-px w-10 bg-pong/60" />
        </div>
      </header>

      {/* MENU scroller — full-width, at the top of the party packages.
          Blank placeholders until photos are uploaded to `xmas.menu`. */}
      <MediaStrip
        galleryKey="xmas.menu"
        heading="This year's festive menu"
        intro="A taste of what's on — swipe through."
        blankLabel="Menu photo"
        aspect="4 / 3"
        blankCount={5}
      />

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          {!hasContent ? (
            <div className="rounded-2xl border border-nodiceRed/40 bg-nodiceRed/10 p-8 text-center">
              <h2 className="font-display text-2xl text-cream">Menus landing soon</h2>
              <p className="mt-3 text-sm leading-relaxed text-cream/80">
                Our Christmas 2026 menus are being finalised. Email{" "}
                <a className="font-semibold text-nodiceRed underline" href="mailto:hello@nodice.bar">
                  hello@nodice.bar
                </a>{" "}
                and we&apos;ll get your party in the diary.
              </p>
            </div>
          ) : (
            <>
              {/* PACKAGES */}
              {packages.length > 0 && (
                <div className="mb-14">
                  <h2 className="font-display text-3xl text-cream sm:text-4xl">
                    Party packages
                  </h2>
                  <p className="mt-2 text-sm text-cream/60">Per head · minimum numbers may apply</p>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    {packages.map((p) => (
                      <article
                        key={p.name}
                        className="flex flex-col rounded-2xl border border-pong/50 bg-white/[0.02] p-6"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-display text-2xl text-cream">{p.name}</h3>
                          <span className="whitespace-nowrap font-display text-2xl text-nodiceRed">
                            {gbp(p.pricePerHead)}
                            <span className="ml-1 text-xs font-normal uppercase tracking-wider text-cream/50">
                              /head
                            </span>
                          </span>
                        </div>
                        {p.blurb && (
                          <p className="mt-3 text-sm leading-relaxed text-cream/75">{p.blurb}</p>
                        )}
                        {p.items.length > 0 && (
                          <ul className="mt-4 flex flex-wrap gap-2">
                            {p.items.map((name, i) => (
                              <li
                                key={i}
                                className="rounded-full border border-pong/40 bg-pong/10 px-3 py-1 text-xs text-pongLight"
                              >
                                {name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* À LA CARTE */}
              {alacarte.length > 0 && (
                <div>
                  <h2 className="font-display text-3xl text-cream sm:text-4xl">By the item</h2>
                  <p className="mt-2 text-sm text-cream/60">
                    Build your own spread — price per head unless noted.
                  </p>
                  <div className="mt-6 space-y-3">
                    {alacarte.map((it) => (
                      <article key={it.name} className="rounded-2xl border border-white/10 p-5">
                        <div className="flex items-baseline justify-between gap-4">
                          <h3 className="font-display text-xl text-cream sm:text-2xl">{it.name}</h3>
                          <span className="whitespace-nowrap font-display text-xl text-nodiceRed sm:text-2xl">
                            {gbp(it.sell)}
                            <span className="ml-1 text-xs font-normal uppercase tracking-wider text-cream/50">
                              {it.board ? "to share" : "/head"}
                            </span>
                          </span>
                        </div>
                        {it.desc && (
                          <p className="mt-2 text-sm leading-relaxed text-cream/70">{it.desc}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* CTA */}
          <div className="mt-14 rounded-2xl border border-nodiceRed/40 bg-gradient-to-br from-nodiceRed/15 to-transparent p-7 text-center">
            <h2 className="font-display text-2xl text-cream sm:text-3xl">
              Planning a Christmas party?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-cream/80">
              Tell us your date, numbers and what you fancy and we&apos;ll put together the
              perfect festive package. We host everything from team lunches to full venue
              takeovers.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:hello@nodice.bar?subject=Christmas%20party%20enquiry"
                className="inline-flex items-center rounded-full bg-nodiceRed px-6 py-3 text-sm font-bold uppercase tracking-wider text-cream transition hover:bg-nodiceRedDeep"
              >
                Email the team
              </a>
              <Link
                href="/privatehire"
                className="inline-flex items-center rounded-full border border-cream/30 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-cream/90 transition hover:border-cream/60"
              >
                Private hire & spaces
              </Link>
            </div>
          </div>

          {/* Allergies + back */}
          <div className="mt-10 rounded-2xl border border-pong/30 bg-pong/[0.06] p-5 text-sm leading-relaxed text-pongLight">
            <strong className="font-bold">Allergies?</strong> Just let our team know when you
            book — we&apos;ll guide you to safe options.
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/venue/hackney"
              className="inline-flex items-center text-sm font-semibold uppercase tracking-wider text-cream/70 transition hover:text-cream"
            >
              ← Back to No Dice
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
