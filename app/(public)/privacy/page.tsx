"use client";

import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";

// =============================================================
// /privacy — Privacy Policy
// =============================================================
// Default body covers UK GDPR + PECR requirements for a small
// hospitality venue:
//   • Identity + contact for the data controller
//   • What's collected, why, and the legal basis
//   • Third-party recipients (Stripe, Supabase, Resend, Behold)
//   • Retention periods
//   • Subject rights + how to exercise them
//   • Complaints route (ICO)
//   • Cookies summary
//
// Founder can override via /admin/content/info/privacy → "privacy.body"
// (raw HTML rendered via dangerouslySetInnerHTML). If body is blank,
// the default JSX below renders. The default IS the policy — get a
// solicitor to review before relying on it for litigation, but for
// day-one publication it's defensible.
// =============================================================

const LAST_UPDATED = "8 June 2026";

export default function PrivacyPage() {
  const title = useContent("privacy.title", "Privacy Policy");
  const body = useContent("privacy.body", "");
  return (
    <main>
      <PageHero
        eyebrow="Legal"
        title={title}
        image=""
        eyebrowKey="privacy.eyebrow"
        titleKey="privacy.title"
        imageKey="privacy.hero_image"
        sliderKey="hero.privacy"
      />
      <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-cream/80 [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-cream [&_p+p]:mt-4 [&_ul]:mt-3 [&_ul]:space-y-1.5 [&_li]:pl-3">
        {body ? (
          <div dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-cream/45">
              Last updated · {LAST_UPDATED}
            </p>
            <p>
              This policy explains how <strong>No Dice Hackney Ltd</strong>{" "}
              ("No Dice", "we", "us") collects and uses personal data when you
              visit{" "}
              <a href="https://nodice.bar">nodice.bar</a> or book with us at
              407 Mentmore Terrace, London Fields, E8 3PH. We are the data
              controller. The company is registered in England &amp; Wales.
            </p>
            <p>
              Questions, requests, or complaints:{" "}
              <a href="mailto:info@nodice.bar">info@nodice.bar</a>.
            </p>

            <h2>1. What we collect</h2>
            <p>
              <strong>If you make a booking</strong> (pool table, bar table,
              tournament, World Cup match): name, email, phone, party size,
              date / time, any notes you give us, and where you heard about
              us. For paid bookings we also receive a Stripe payment-intent
              ID and confirmation status — the actual card data goes directly
              to Stripe and never touches our servers.
            </p>
            <p>
              <strong>If you tick the marketing opt-in:</strong> we add your
              email to a list we use to send occasional updates about events,
              deals, and new offerings. You can unsubscribe from every email
              we send, and ticking the box is not required to make a booking.
            </p>
            <p>
              <strong>If you simply browse:</strong> minimal technical data
              from your browser (cookies — see Section 6) and, only with
              your consent, basic analytics about which pages you viewed.
            </p>

            <h2>2. Why we use it (legal basis)</h2>
            <ul>
              <li>
                <strong>To deliver bookings you've made</strong> — contract
                performance (UK GDPR Article 6(1)(b)).
              </li>
              <li>
                <strong>To take payment via Stripe</strong> — contract
                performance, and the legal obligations imposed on us as a
                merchant.
              </li>
              <li>
                <strong>To send marketing emails</strong> — your explicit
                consent (UK GDPR Article 6(1)(a) + PECR), which you can
                withdraw at any time.
              </li>
              <li>
                <strong>To improve the site and decide where to invest in
                ads</strong> — legitimate interests, but only when you've
                also accepted analytics / marketing cookies.
              </li>
              <li>
                <strong>To keep accounting records</strong> — legal
                obligation (Companies Act 2006 + HMRC rules require us to
                retain transaction records for at least 6 years).
              </li>
            </ul>

            <h2>3. Who we share data with</h2>
            <p>
              We do <strong>not</strong> sell personal data. We use a small
              set of trusted processors to actually run the site and the
              bookings:
            </p>
            <ul>
              <li>
                <strong>Stripe Payments UK Ltd</strong> — card processing.
                See{" "}
                <a
                  href="https://stripe.com/gb/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  stripe.com/gb/privacy
                </a>
                .
              </li>
              <li>
                <strong>Supabase Inc.</strong> — database hosting for the
                booking records (EU region).
              </li>
              <li>
                <strong>Resend</strong> — sending confirmation emails. See{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  resend.com/legal/privacy-policy
                </a>
                .
              </li>
              <li>
                <strong>Behold.so</strong> — embedded Instagram feed on the
                events page (only loads if you've accepted marketing cookies).
              </li>
              <li>
                <strong>GitHub Pages</strong> — static-site hosting for the
                website.
              </li>
            </ul>
            <p>
              Where any processor sits outside the UK / EEA, transfers rely
              on the UK International Data Transfer Addendum or the EU
              Standard Contractual Clauses.
            </p>
            <p>
              We may also disclose data where we are legally required to
              (e.g. responding to a valid court order or HMRC investigation).
            </p>

            <h2>4. How long we keep it</h2>
            <ul>
              <li>
                <strong>Booking + payment records:</strong> 6 years after
                the booking date (Companies Act / HMRC).
              </li>
              <li>
                <strong>Marketing opt-in list:</strong> until you
                unsubscribe, or until 3 years of inactivity, whichever is
                sooner.
              </li>
              <li>
                <strong>Customer service emails:</strong> 2 years after the
                conversation ends.
              </li>
              <li>
                <strong>Cookie consent record:</strong> 12 months from your
                last decision.
              </li>
            </ul>

            <h2>5. Your rights</h2>
            <p>
              Under UK GDPR you have the right to: access your data; have
              it corrected; have it deleted (subject to our legal
              retention obligations above); restrict or object to certain
              processing; receive a portable copy; and withdraw consent at
              any time.
            </p>
            <p>
              Email{" "}
              <a href="mailto:info@nodice.bar">info@nodice.bar</a> to
              exercise any of these. We'll respond within one month.
            </p>
            <p>
              If you think we've handled your data badly, you can complain
              to the Information Commissioner's Office at{" "}
              <a
                href="https://ico.org.uk/concerns/"
                target="_blank"
                rel="noreferrer"
              >
                ico.org.uk
              </a>{" "}
              — though we'd appreciate the chance to put it right first.
            </p>

            <h2>6. Cookies</h2>
            <p>
              We use three categories of cookies. You can change your
              preferences any time via the "Cookie settings" link in the
              footer.
            </p>
            <ul>
              <li>
                <strong>Strictly necessary</strong> — make the site and the
                booking flow work (session storage, Stripe payment session,
                cookie-consent record). Cannot be turned off.
              </li>
              <li>
                <strong>Analytics</strong> — anonymised page-view data so
                we know which pages people use. Off until you accept.
              </li>
              <li>
                <strong>Marketing</strong> — measurement pixels for Meta /
                Google / TikTok ads, and the embedded Instagram feed. Off
                until you accept.
              </li>
            </ul>

            <h2>7. Changes</h2>
            <p>
              We'll update this page if our processing changes materially.
              The "Last updated" date at the top reflects the most recent
              edit. Material changes affecting marketing consent will also
              be flagged in our next email.
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
