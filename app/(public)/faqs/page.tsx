"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { loadFaqs, groupFaqs, type DbFaq } from "@/lib/db/faqs";

type FAQ = { q: string; a: React.ReactNode };
type Section = { heading: string; faqs: FAQ[] };

const SECTIONS: Section[] = [
  {
    heading: "Booking basics",
    faqs: [
      {
        q: "How do I book a round at Plonk?",
        a: (
          <>
            Pick a venue at{" "}
            <Link href="/book" className="underline-offset-4 hover:underline">
              plonkgolf.co.uk/book
            </Link>
            , choose a date and time, set your party size and any add-ons, then
            pay with card, Apple Pay or Google Pay. Your booking confirmation
            email arrives within seconds.
          </>
        ),
      },
      {
        q: "How long does a round take?",
        a: "About 30–40 minutes for a group of four — longer for bigger groups. After your round you're welcome to stay in the bar / arcade as long as you like.",
      },
      {
        q: "What does my ticket include?",
        a: "A single round on the crazy golf course (one putter, one ball per person, scorecard). Drinks, food and arcade tokens are extra — you can add them to your booking or buy at the bar.",
      },
      {
        q: "Do I need to print my ticket?",
        a: "No. Your confirmation email is enough — show it to staff on your phone when you arrive.",
      },
    ],
  },
  {
    heading: "Slots, capacity and big groups",
    faqs: [
      {
        q: "How do the time slots work?",
        a: "Each course takes a tee-off every 10 minutes, with up to 6 players per slot. That's so groups don't pile up on the same hole. You'll see exactly how many tickets are left in each slot when you pick a time.",
      },
      {
        q: "What if my group is bigger than 6?",
        a: (
          <>
            For groups of 7–12, pick a start time and add everyone — we'll
            split you across <strong>two consecutive 10-minute slots</strong>{" "}
            so everyone fits in. One booking, one payment, one reference.
            Although your two slots are 10 minutes apart, you can all play
            together at the later start time.
          </>
        ),
      },
      {
        q: "What if only 2 spots are left in my preferred slot but I have 4 people?",
        a: "You can still book all 4. The system fills the rest from the very next 10-minute slot. You'll see exactly how your party splits before you pay — for example: '17:30 — 2 players, 17:40 — 2 players'. Everyone in your group can meet up and play together at 17:40.",
      },
      {
        q: "Why is my preferred time greyed out?",
        a: "It's sold out — all 6 tickets in that slot have already been booked. Try a slot earlier or later, or pick a different date.",
      },
      {
        q: "I want to book for 13 or more people",
        a: (
          <>
            Online bookings cap at 12 across two consecutive slots — for
            anything bigger, please email{" "}
            <a href="mailto:info@plonkgolf.co.uk" className="underline-offset-4 hover:underline">
              info@plonkgolf.co.uk
            </a>{" "}
            and our team will arrange it directly, or see our{" "}
            <Link href="/private-hire" className="underline-offset-4 hover:underline">
              private hire page
            </Link>{" "}
            for full venue takeovers.
          </>
        ),
      },
    ],
  },
  {
    heading: "Pricing and offers",
    faqs: [
      {
        q: "Do prices include VAT?",
        a: "No — Plonk is currently below the UK VAT registration threshold, so we don't charge VAT. The price you see is the price you pay; there are no added taxes or hidden fees.",
      },
      {
        q: "Is there a happy hour?",
        a: "At Plonk Hackney, all golf tickets are £5 per person Tuesday to Friday before 5pm. Drink deals run at the bar Mon–Fri til 7pm.",
      },
      {
        q: "What's the Monday Plonk Hackney deal?",
        a: "Buy one, get one free on tickets all day every Monday at Plonk Hackney — automatically applied as soon as you pick a Monday slot. No code needed.",
      },
      {
        q: "What's the Tuesday Hackney bundle?",
        a: "Every Tuesday at Plonk Hackney we offer the Drink, Golf & Game bundle for £12 per person — a round of golf, a house drink (cocktail / beer / soft) and 4 arcade tokens. Available on the booking page when you pick a Tuesday slot.",
      },
      {
        q: "Do you offer student or hospitality discounts?",
        a: "Yes — 10% off with valid ID, in venue. Use code STUDENT10 at online checkout. Cannot be combined with other offers.",
      },
    ],
  },
  {
    heading: "Children and age rules",
    faqs: [
      {
        q: "Can children play?",
        a: "Yes — under-16s are welcome until 6pm each day. They must be accompanied by at least one adult on the booking.",
      },
      {
        q: "Why can't I add a child ticket to my evening booking?",
        a: "Children's tickets are only available for slots before 6pm. For an evening visit pick a time at 17:50 or earlier.",
      },
      {
        q: "Is there a minimum age?",
        a: "We welcome golfers of any age — toddlers included. Buggies can be parked at the bar while you play.",
      },
      {
        q: "Are pool tables age-restricted?",
        a: "Yes — under-16s aren't permitted to play on the pool tables at either venue.",
      },
    ],
  },
  {
    heading: "Payment, hold and refunds",
    faqs: [
      {
        q: "What's the 15-minute ticket hold?",
        a: "When you click 'Continue to checkout', your chosen tickets are held for you for 15 minutes so nobody else can book them while you enter your details. If you don't finish payment in that window, the tickets are released back into the pool.",
      },
      {
        q: "How is payment taken?",
        a: "Securely via Stripe. We accept all major credit and debit cards, Apple Pay, Google Pay and Link. Money goes straight to Plonk Golf — we don't store your card details ourselves.",
      },
      {
        q: "Can I cancel or change my booking?",
        a: (
          <>
            Yes — email{" "}
            <a href="mailto:info@plonkgolf.co.uk" className="underline-offset-4 hover:underline">
              info@plonkgolf.co.uk
            </a>{" "}
            with your booking reference and what you'd like to do. We'll move
            you to another available slot or process a refund.
          </>
        ),
      },
      {
        q: "How long do refunds take?",
        a: "Refunds are processed immediately on our end, but it can take 5–10 working days for the money to land back on your card depending on your bank.",
      },
    ],
  },
  {
    heading: "Vouchers and promo codes",
    faqs: [
      {
        q: "How do gift vouchers work?",
        a: (
          <>
            Buy one on our{" "}
            <Link href="/vouchers" className="underline-offset-4 hover:underline">
              Vouchers page
            </Link>{" "}
            and the recipient gets a unique code by email. They're valid for
            12 months, redeemable at either venue, and can be spent in parts —
            no need to use the full balance in one go.
          </>
        ),
      },
      {
        q: "How do I redeem a promo code or voucher at checkout?",
        a: "Enter the code in the 'Promo code' field on the booking page before continuing to checkout. The discount is applied to your basket and the new total is shown.",
      },
      {
        q: "I have a Fever / TimeOut / Wowcher voucher",
        a: (
          <>
            These are processed manually — email{" "}
            <a href="mailto:info@plonkgolf.co.uk" className="underline-offset-4 hover:underline">
              info@plonkgolf.co.uk
            </a>{" "}
            with your voucher code and preferred date/time and we'll get you
            booked in.
          </>
        ),
      },
    ],
  },
  {
    heading: "On the day",
    faqs: [
      {
        q: "What time should I arrive?",
        a: "Aim for 10 minutes before your start time so you've got time to grab a drink, get your scorecard and warm up your swing.",
      },
      {
        q: "I'm running late — will I still be able to play?",
        a: "We'll do our best. Ten or fifteen minutes is usually fine. If you'll be significantly later, especially on a Saturday, we can't guarantee a spot but we'll always try to fit you in around other bookings.",
      },
      {
        q: "Do you accept walk-ins?",
        a: "Yes, but pre-booked ticket holders always get priority. Saturdays are often fully booked — we strongly recommend booking ahead.",
      },
      {
        q: "Can I bring my own food or drink?",
        a: "No — but with cocktails, draught beers, tacos at Hackney and a full menu at Borough you won't go hungry or thirsty.",
      },
      {
        q: "Can I bring my dog?",
        a: "Well-behaved dogs are welcome in the beer garden at Plonk Hackney. Borough is indoors so dogs aren't allowed inside.",
      },
    ],
  },
  {
    heading: "Accessibility",
    faqs: [
      {
        q: "Is Plonk Borough accessible?",
        a: (
          <>
            Yes. There are step-free routes down to our courtyard. If you'd
            like the easiest route mapped out before you arrive, email{" "}
            <a href="mailto:info@plonkgolf.co.uk" className="underline-offset-4 hover:underline">
              info@plonkgolf.co.uk
            </a>{" "}
            and we'll help.
          </>
        ),
      },
      {
        q: "Is Plonk Hackney accessible?",
        a: "The bar, beer garden and most of the course is on one level. Drop us a line at info@plonkgolf.co.uk ahead of your visit and we'll make sure everything's set up for you.",
      },
    ],
  },
  {
    heading: "Find us",
    faqs: [
      {
        q: "Where is Plonk Hackney?",
        a: "Arch 407, Mentmore Terrace, London E8 3PP. Main entrance on Parkside. 2 mins from London Fields Overground, 5 mins from Broadway Market.",
      },
      {
        q: "Where is Plonk Borough Market?",
        a: "Arches B, C, D & E Montague Close, off Green Dragon Court, London SE1 9DA. Don't follow the postcode — search 'Plonk Borough' on Google Maps. The entrance is in a courtyard just below street level, next door to Boro Bistro.",
      },
    ],
  },
];

export default function FAQsPage() {
  const title = useContent("faqs.title", "Booking FAQs");
  const intro = useContent(
    "faqs.intro",
    "Everything you need to know about how Plonk bookings work — slots, splits, prices, refunds, and what happens on the day.",
  );
  const [dbFaqs, setDbFaqs] = useState<DbFaq[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFaqs()
      .then((data) => {
        if (!cancelled) setDbFaqs(data);
      })
      .catch(() => {
        // Fall back to the hardcoded SECTIONS below if Supabase fails.
        if (!cancelled) setDbFaqs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the admin has added any FAQs in Supabase, use those; otherwise fall
  // back to the hardcoded SECTIONS. Plain-text answers from the DB render
  // as paragraphs, while the legacy SECTIONS keep their rich React content.
  const showDb = dbFaqs && dbFaqs.length > 0;
  const grouped = showDb ? groupFaqs(dbFaqs) : [];

  return (
    <main>
      <PageHero
        eyebrow="Help & info"
        title={title}
        intro={intro}
        image="/hackney/games/Games_2.jpg"
        eyebrowKey="faqs.eyebrow"
        titleKey="faqs.title"
        introKey="faqs.intro"
        imageKey="faqs.hero_image"
        sliderKey="hero.faqs"
      />

      <section className="bed-hackney">
      <div className="mx-auto max-w-3xl px-6 py-20">
        {showDb
          ? grouped.map((section) => (
              <div key={section.section} className="mb-10 last:mb-0">
                <h2 className="mb-4 font-display text-2xl text-plonkYellow">
                  {section.section}
                </h2>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-cream/10 bg-black/20 backdrop-blur"
                    >
                      <details className="group p-5">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                          <span className="font-display text-base sm:text-lg">
                            {item.question}
                          </span>
                          <span
                            className="text-plonkYellow transition group-open:rotate-45"
                            aria-hidden
                          >
                            +
                          </span>
                        </summary>
                        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-cream/80">
                          {item.answer}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          : SECTIONS.map((section) => (
          <div key={section.heading} className="mb-10 last:mb-0">
            <h2 className="mb-4 font-display text-2xl text-plonkYellow">
              {section.heading}
            </h2>
            <ul className="space-y-3">
              {section.faqs.map((item) => (
                <li
                  key={item.q}
                  className="rounded-2xl border border-cream/10 bg-black/20 backdrop-blur"
                >
                  <details className="group p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <span className="font-display text-base sm:text-lg">
                        {item.q}
                      </span>
                      <span
                        className="text-plonkYellow transition group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <div className="mt-3 text-sm leading-relaxed text-cream/80">
                      {item.a}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="mt-12 text-center text-sm text-cream/60">
          Got a question we haven't answered?{" "}
          <a
            href="mailto:info@plonkgolf.co.uk"
            className="underline-offset-4 hover:text-cream hover:underline"
          >
            Email the team
          </a>{" "}
          — we read every message.
        </p>
      </div>
      </section>
    </main>
  );
}
