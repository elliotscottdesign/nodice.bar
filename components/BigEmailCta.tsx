import Reveal from "@/components/Reveal";

export default function BigEmailCta({
  subject = "Private Hire Enquiry",
  eyebrow = "Ready to chat?",
  heading = "Drop our bookings team a line.",
  body = "Tell us roughly when, how many people, and which venue — we'll come back fast with availability, set-up options and pricing.",
}: {
  subject?: string;
  eyebrow?: string;
  heading?: string;
  body?: string;
}) {
  const subjectParam = encodeURIComponent(subject);
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
            {eyebrow}
          </p>
          <h2 className="mt-6 font-display text-4xl leading-tight sm:text-5xl">
            {heading}
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <a
            href={`mailto:info@plonkgolf.co.uk?subject=${subjectParam}`}
            className="mt-10 block break-all font-display text-3xl text-plonkYellow underline decoration-plonkYellow/40 decoration-2 underline-offset-8 transition hover:text-cream hover:decoration-cream sm:text-5xl md:text-6xl"
          >
            info@plonkgolf.co.uk
          </a>
        </Reveal>
        <Reveal delay={240}>
          <p className="mx-auto mt-10 max-w-xl text-sm leading-relaxed text-cream/70 sm:text-base">
            {body}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
