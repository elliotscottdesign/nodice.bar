"use client";

import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";

// =============================================================
// /terms — Terms & Conditions
// =============================================================
// Default body covers website use AND the booking-specific terms
// customers agree to at checkout (pool tables, bar tables,
// tournaments, World Cup match-night reservations). Founder can
// override the body in /admin/content/info/terms → "terms.body"
// (raw HTML). Default = the policy; have a solicitor check before
// relying on it in a dispute, but it's defensible at launch.
// =============================================================

const LAST_UPDATED = "8 June 2026";

export default function TermsPage() {
  const title = useContent("terms.title", "Terms & Conditions");
  const body = useContent("terms.body", "");
  return (
    <main>
      <PageHero
        eyebrow="Legal"
        title={title}
        image=""
        eyebrowKey="terms.eyebrow"
        titleKey="terms.title"
        imageKey="terms.hero_image"
        sliderKey="hero.terms"
      />
      <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-cream/80 [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-cream [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-cream [&_p+p]:mt-4 [&_ul]:mt-3 [&_ul]:space-y-1.5 [&_li]:pl-3">
        {body ? (
          <div dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-cream/45">
              Last updated · {LAST_UPDATED}
            </p>
            <p>
              These terms cover both the use of <strong>nodice.bar</strong>{" "}
              and any booking you make with us. The venue is operated by{" "}
              <strong>No Dice Hackney Ltd</strong>, a company registered in
              England &amp; Wales, trading from 407 Mentmore Terrace,
              London Fields, E8 3PH ("we", "us", "No Dice").
            </p>
            <p>
              By using this website or making a booking you agree to these
              terms. If you don't agree, please don't use the site or book
              with us.
            </p>

            <h2>1. The Website</h2>
            <p>
              The site is provided for your information and convenience.
              We try to keep content accurate but make no warranties about
              completeness or suitability for any particular purpose.
              Prices, opening hours and event listings are subject to
              change.
            </p>
            <p>
              All trade marks, copy and design on this site belong to No
              Dice Hackney Ltd. You may view and print pages for personal
              use; you may not copy our content for commercial use without
              written permission.
            </p>

            <h2>2. Bookings — general</h2>
            <p>
              A booking is a contract between you and No Dice Hackney
              Ltd. It is only confirmed when:
            </p>
            <ul>
              <li>
                you receive a confirmation email from{" "}
                <a href="mailto:info@nodice.bar">info@nodice.bar</a>, AND
              </li>
              <li>
                where payment is required, your card has successfully been
                charged (we use Stripe — your card details never touch our
                servers).
              </li>
            </ul>
            <p>
              You must be 18 or over to make a booking. We may refuse
              entry, eject anyone, or cancel a booking on the day where
              house policy or licensing law requires it (e.g. visibly
              intoxicated guests, refusal of ID).
            </p>

            <h2>3. Pool table bookings (/book/pool)</h2>
            <h3>Price</h3>
            <p>
              Slot prices are shown on the booking page before you pay.
              Pricing rules (length of slot, Monday discount, etc.) are
              live from our admin and can change without notice. The
              price you see and agree to at checkout is the price you
              pay.
            </p>
            <h3>Cancellation &amp; refunds</h3>
            <p>
              Pool slots are non-refundable within 24 hours of the
              start. Cancel more than 24 hours in advance and we'll
              refund in full minus the Stripe processing fee. To cancel,
              reply to your confirmation email.
            </p>
            <h3>Late arrival</h3>
            <p>
              We'll hold your table for 15 minutes past the slot start.
              After that we may release it to another guest. Your booking
              still ends at the original end time.
            </p>

            <h2>4. Bar table reservations (/book/table)</h2>
            <p>
              Bar table reservations are free to make and are a
              best-efforts hold — we'll keep the table for you for the
              first 15 minutes after the start time. If you haven't
              arrived by then we may release it.
            </p>
            <p>
              If you cancel a free reservation, please drop us an email so
              we can offer it to someone else. Repeat no-shows may be
              declined further bookings.
            </p>

            <h2>5. Pool tournament entries</h2>
            <p>
              Tournament sign-ups are pre-paid via Stripe. Entry fees are
              non-refundable, but transferable to another team in the same
              tournament with at least 24 hours' notice — email{" "}
              <a href="mailto:info@nodice.bar">info@nodice.bar</a>.
            </p>
            <p>
              If we have to cancel a tournament (low entries, force
              majeure), entry fees are refunded in full automatically via
              Stripe within 7 working days.
            </p>

            <h2>6. World Cup match reservations</h2>
            <p>
              Match-night tables are reserved with a{" "}
              <strong>£15 bar tab minimum spend per table</strong>{" "}
              (current as of the date above; subject to change for
              specific high-demand matches, which will be flagged on the
              booking page). Your £15 is taken at the time of booking and
              applied as credit against your bar tab on the night.
            </p>
            <p>
              You must arrive by kick-off; tables not occupied by then may
              be released to walk-ins. We can't refund the deposit if the
              fixture is moved by FIFA, but we'll move the credit to
              another match if your team is eliminated and we're notified
              before the next round starts.
            </p>
            <p>
              House rules apply throughout the tournament — abusive
              chanting, fighting and similar will result in ejection and
              forfeiture of the deposit.
            </p>

            <h2>7. Payments</h2>
            <p>
              Where payment is required we use{" "}
              <a
                href="https://stripe.com/gb"
                target="_blank"
                rel="noreferrer"
              >
                Stripe
              </a>{" "}
              to process card payments. By proceeding to payment you also
              accept Stripe's terms. We do not store your card details.
              You'll receive a Stripe receipt by email separately to our
              booking confirmation.
            </p>

            <h2>8. Liability</h2>
            <p>
              Nothing in these terms limits our liability for death or
              personal injury caused by our negligence, fraud, or any
              other liability that cannot be limited under UK law.
            </p>
            <p>
              Subject to the above, our total liability to you for any
              booking is limited to the amount you actually paid for that
              booking. We are not liable for indirect or consequential
              losses (e.g. travel costs to a cancelled event).
            </p>

            <h2>9. Privacy</h2>
            <p>
              We handle personal data in line with our{" "}
              <a href="/privacy">Privacy Policy</a>. By making a booking
              you confirm you've read it.
            </p>

            <h2>10. Governing law</h2>
            <p>
              These terms are governed by the law of England and Wales.
              Any dispute will be heard in the courts of England and
              Wales.
            </p>

            <h2>11. Changes to these terms</h2>
            <p>
              We may update these terms; the "Last updated" date at the
              top will reflect the change. The terms in force at the time
              you made your booking are the terms that apply to that
              booking.
            </p>

            <p className="!mt-10 text-xs text-cream/55">
              No Dice Hackney Ltd · 407 Mentmore Terrace · London Fields ·
              E8 3PH ·{" "}
              <a href="mailto:info@nodice.bar">info@nodice.bar</a>
            </p>
          </>
        )}
      </article>
    </main>
  );
}
