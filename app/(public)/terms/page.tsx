"use client";

import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";

export default function TermsPage() {
  const title = useContent("terms.title", "Terms & Conditions");
  const body = useContent("terms.body", "");
  return (
    <main>
      <PageHero
        eyebrow="Legal"
        title={title}
        image="/hackney/course/Course_3.jpg"
        eyebrowKey="terms.eyebrow"
        titleKey="terms.title"
        imageKey="terms.hero_image"
        sliderKey="hero.terms"
      />
      <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-cream/80 [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_p+p]:mt-4">
        {body ? (
          <div dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <p>
            The full Plonk Golf terms &amp; conditions are being updated
            alongside the new booking system. For booking-specific questions
            in the meantime, please email{" "}
            <a href="mailto:info@plonkgolf.co.uk">info@plonkgolf.co.uk</a>.
          </p>
        )}
      </article>
    </main>
  );
}
