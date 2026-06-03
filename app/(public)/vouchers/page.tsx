"use client";

import Link from "next/link";
import PageHero from "@/components/PageHero";
import { useContent, useImage } from "@/lib/content";
import { Editable } from "@/components/Editable";

export default function VouchersPage() {
  const eyebrow = useContent("vouchers.eyebrow", "Gifts & vouchers");
  const title = useContent("vouchers.title", "The Gift of Golf");
  const intro = useContent(
    "vouchers.intro",
    "Looking for an unusual gift for a friend or loved one? Forgot someone's birthday? We've got you covered.",
  );
  const heroImage = useImage(
    "vouchers.hero_image",
    "/borough/drinks/Cocktail_1.jpg",
  );
  const body = useContent(
    "vouchers.body",
    "All of our vouchers are valid for twelve months from the date of purchase, and redeemable against any ticket at any of our venues. They're also redeemable up to their full value, so no need to spend them all at once.",
  );
  const ctaLabel = useContent("vouchers.cta_label", "Buy a Voucher");
  const ctaNote = useContent(
    "vouchers.cta_note",
    "Vouchers shop coming with the new booking system — meanwhile, email info@plonkgolf.co.uk to arrange one.",
  );

  const perks: { title: string; body: string }[] = [
    {
      title: useContent("vouchers.perk1.title", "Valid for 12 months"),
      body: useContent(
        "vouchers.perk1.body",
        "Every voucher is valid for a full year from the date of purchase — plenty of time to find a date that works.",
      ),
    },
    {
      title: useContent("vouchers.perk2.title", "Use across all venues"),
      body: useContent(
        "vouchers.perk2.body",
        "Redeemable against any ticket at any of our venues — Hackney and Borough Market.",
      ),
    },
    {
      title: useContent("vouchers.perk3.title", "Spend at your own pace"),
      body: useContent(
        "vouchers.perk3.body",
        "Redeemable up to the full value — no need to spend it all at once.",
      ),
    },
  ];

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image={heroImage}
        eyebrowKey="vouchers.eyebrow"
        titleKey="vouchers.title"
        introKey="vouchers.intro"
        imageKey="vouchers.hero_image"
        sliderKey="hero.vouchers"
      />

      <section className="mx-auto max-w-none px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="whitespace-pre-line text-base leading-relaxed text-cream/80 sm:text-lg">
            <Editable k="vouchers.body" multiline>{body}</Editable>
          </p>

          <Link
            href="/#venues"
            className="mt-8 inline-block rounded-full bg-plonkPink px-10 py-4 text-base font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
          >
            <Editable k="vouchers.cta_label">{ctaLabel}</Editable>
          </Link>
          {ctaNote && (
            <p className="mt-3 whitespace-pre-line text-xs text-cream/50">
              <Editable k="vouchers.cta_note" multiline>{ctaNote}</Editable>
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 md:grid-cols-3">
            {perks.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl border border-plumLine/60 p-6"
              >
                <h3 className="font-display text-xl">
                  <Editable k={`vouchers.perk${i + 1}.title`}>{p.title}</Editable>
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/75">
                  <Editable k={`vouchers.perk${i + 1}.body`} multiline>{p.body}</Editable>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
