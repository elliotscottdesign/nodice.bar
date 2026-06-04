"use client";

import { useContent } from "@/lib/content";

// /plonk — repurposed as the general contact page per founder brief.
// Single-screen layout: title, blurb, four contact cards.
//
// CMS surface (every field below editable from /admin):
//   plonk.eyebrow / plonk.title / plonk.intro
//   plonk.email / plonk.phone / plonk.address / plonk.hours
//   plonk.instagram / plonk.instagram_label

export default function PlonkPage() {
  const eyebrow = useContent("plonk.eyebrow", "Say hi");
  const title = useContent("plonk.title", "Contact");
  const intro = useContent(
    "plonk.intro",
    "Get in touch about bookings, events, press or anything else No Dice.",
  );
  const email = useContent("plonk.email", "info@nodice.bar");
  const phone = useContent("plonk.phone", "");
  const address = useContent(
    "plonk.address",
    "Arch 407 Mentmore Terrace, London Fields, Hackney E8 3PH",
  );
  const hours = useContent(
    "plonk.hours",
    "Tue–Thu 4pm–12am · Fri 4pm–2am · Sat 12pm–2am · Sun 12pm–11pm",
  );
  const instagram = useContent(
    "plonk.instagram",
    "https://www.instagram.com/nodicelondon/",
  );
  const instagramLabel = useContent(
    "plonk.instagram_label",
    "@nodicelondon",
  );

  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-plonkPink">
          {eyebrow}
        </div>
        <h1 className="font-display text-5xl uppercase tracking-wider sm:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-cream/75">{intro}</p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <ContactBlock
            label="Email"
            value={email}
            href={`mailto:${email}`}
          />
          {phone && (
            <ContactBlock
              label="Phone"
              value={phone}
              href={`tel:${phone.replace(/\s/g, "")}`}
            />
          )}
          <ContactBlock
            label="Address"
            value={address}
            href={`https://www.google.com/maps?q=${encodeURIComponent(address)}`}
          />
          <ContactBlock label="Hours" value={hours} />
          <ContactBlock
            label="Instagram"
            value={instagramLabel}
            href={instagram}
          />
        </div>
      </div>
    </main>
  );
}

function ContactBlock({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-plonkPink">
        {label}
      </div>
      <div className="mt-2 text-sm text-cream/90">{value}</div>
    </>
  );
  return (
    <div className="rounded-xl border border-cream/10 p-6 text-left">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition hover:opacity-80"
        >
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
