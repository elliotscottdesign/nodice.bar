"use client";

import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";
import { Editable } from "@/components/Editable";

// =============================================================
// /contact — Get in touch
// =============================================================
// Single-column layout, one card per channel. Every label, blurb,
// link, address and social URL is CMS-editable so the founder can
// tune it from the live page or /admin/content/info/contact.
//
// The old page had a free-form HTML "body" field PLUS a hardcoded
// section that duplicated the "drop us a line" framing AND still
// referenced the Plonk Golf brand. That's gone — anything inline-
// editable now uses structured keys so the data is clean.
// =============================================================

export default function ContactPage() {
  const eyebrow = useContent("contact.eyebrow", "Get in touch");
  const title = useContent("contact.title", "Say Hello");
  const intro = useContent(
    "contact.intro",
    "For group bookings, partnership enquiries or anything else — drop us a line, we read every message.",
  );

  const emailLabel = useContent("contact.email_label", "Email us");
  const emailAddress = useContent(
    "contact.email_address",
    "info@nodice.bar",
  );
  const emailBlurb = useContent(
    "contact.email_blurb",
    "Best for group bookings, dietary requests, accessibility questions, press, and anything that needs a written reply.",
  );

  const addressLabel = useContent("contact.address_label", "Visit");
  const addressLine1 = useContent(
    "contact.address_line1",
    "Arch 407, Mentmore Terrace",
  );
  const addressLine2 = useContent(
    "contact.address_line2",
    "London Fields, Hackney, E8 3PH",
  );
  const addressBlurb = useContent(
    "contact.address_blurb",
    "Two minutes from London Fields station. We're under the arches behind the park.",
  );
  const mapHref = useContent(
    "contact.map_href",
    "https://maps.google.com/?q=Arch+407+Mentmore+Terrace+London+E8+3PH",
  );

  const hoursLabel = useContent("contact.hours_label", "Opening hours");
  const hoursBody = useContent(
    "contact.hours_body",
    "Mon–Thu 3pm – 11pm\nFri 12pm – 12am\nSat 12pm – 12am\nSun 12pm – 11pm",
  );

  const socialLabel = useContent("contact.social_label", "Follow No Dice");
  const instagramHref = useContent(
    "contact.instagram_href",
    "https://www.instagram.com/nodice.bar/",
  );
  const facebookHref = useContent(
    "contact.facebook_href",
    "https://www.facebook.com/nodice.bar",
  );

  return (
    <main>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        intro={intro}
        image=""
        eyebrowKey="contact.eyebrow"
        titleKey="contact.title"
        introKey="contact.intro"
        imageKey="contact.hero_image"
        sliderKey="hero.contact"
      />

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          {/* Email card — big, clear, tap-to-mail */}
          <a
            href={`mailto:${emailAddress}`}
            className="group rounded-2xl border border-plumLine/60 bg-ink/40 p-7 transition hover:border-plonkPink/60 hover:bg-plonkPink/5 sm:col-span-2"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-plonkPink">
              <Editable k="contact.email_label">{emailLabel}</Editable>
            </p>
            <p className="mt-3 font-display text-3xl text-cream group-hover:underline sm:text-4xl">
              <Editable k="contact.email_address">{emailAddress}</Editable>
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-cream/70">
              <Editable k="contact.email_blurb" multiline>
                {emailBlurb}
              </Editable>
            </p>
          </a>

          {/* Address card */}
          <div className="rounded-2xl border border-plumLine/60 bg-ink/40 p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-plonkPink">
              <Editable k="contact.address_label">{addressLabel}</Editable>
            </p>
            <address className="mt-3 not-italic font-display text-xl leading-snug text-cream sm:text-2xl">
              <Editable k="contact.address_line1">{addressLine1}</Editable>
              <br />
              <Editable k="contact.address_line2">{addressLine2}</Editable>
            </address>
            <p className="mt-4 text-sm leading-relaxed text-cream/70">
              <Editable k="contact.address_blurb" multiline>
                {addressBlurb}
              </Editable>
            </p>
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-plonkPink hover:underline"
            >
              Open in Google Maps ↗
            </a>
          </div>

          {/* Opening hours card */}
          <div className="rounded-2xl border border-plumLine/60 bg-ink/40 p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-plonkPink">
              <Editable k="contact.hours_label">{hoursLabel}</Editable>
            </p>
            <pre className="mt-3 whitespace-pre-line font-display text-base leading-relaxed text-cream sm:text-lg">
              <Editable k="contact.hours_body" multiline>
                {hoursBody}
              </Editable>
            </pre>
          </div>

          {/* Social card */}
          <div className="rounded-2xl border border-plumLine/60 bg-ink/40 p-7 sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-widest text-plonkPink">
              <Editable k="contact.social_label">{socialLabel}</Editable>
            </p>
            <ul className="mt-4 flex flex-wrap gap-4">
              <li>
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-cream/15 px-5 py-2.5 text-sm text-cream hover:border-plonkPink hover:text-plonkPink"
                >
                  Instagram ↗
                </a>
              </li>
              <li>
                <a
                  href={facebookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-cream/15 px-5 py-2.5 text-sm text-cream hover:border-plonkPink hover:text-plonkPink"
                >
                  Facebook ↗
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
