"use client";

import PageHero from "@/components/PageHero";
import { useContent } from "@/lib/content";

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
      <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-cream/80 [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_p+p]:mt-4">
        {body ? (
          <div dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <p>
            The full No Dice privacy policy is being updated alongside the
            new booking system. In the meantime, any questions about how we
            handle your data can be sent to{" "}
            <a href="mailto:info@nodice.bar">info@nodice.bar</a>.
          </p>
        )}
      </article>
    </main>
  );
}
