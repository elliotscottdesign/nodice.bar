"use client";

import Image from "next/image";
import HeroSlider from "./HeroSlider";
import { Editable, DisplayImage } from "./Editable";
import { useGallery } from "@/lib/content";
import ManageGalleryLink from "./ManageGalleryLink";

export default function PageHero({
  eyebrow,
  title,
  intro,
  image,
  eyebrowKey,
  titleKey,
  introKey,
  imageKey,
  sliderKey,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** Pass a single src for a static hero, or an array for an auto-cycling slider.
   *  Used as the fallback when no admin-managed slider gallery has been populated.
   */
  image: string | string[];
  /** When set, the matching text becomes click-to-edit in admin Edit mode.
   *  Each page that mounts a PageHero passes its own keys. If a key is
   *  omitted, the text renders plain (back-compat for older callers). */
  eyebrowKey?: string;
  titleKey?: string;
  introKey?: string;
  /** Single-image fallback key — used only when sliderKey is empty
   *  AND the gallery has no images. */
  imageKey?: string;
  /** Gallery key driving the auto-cycling hero slider. When the admin
   *  uploads images to /admin/content/galleries → this gallery, the
   *  hero becomes a slider through those images. With zero images
   *  uploaded, falls back to the `image` prop (single or array). */
  sliderKey?: string;
}) {
  // Gallery-managed slider images. useGallery returns the fallback
  // when the DB has no rows, so calling it with the static fallback
  // is safe even before the gallery has been seeded.
  const fallbackArray = Array.isArray(image)
    ? image.map((src) => ({ src, alt: null as string | null }))
    : [{ src: image as string, alt: null }];
  const sliderImages = useGallery(sliderKey ?? "__hero_slider_none__", fallbackArray);

  const useSlider = sliderImages.length > 1;
  const singleSrc =
    sliderImages.length === 1
      ? sliderImages[0].src
      : Array.isArray(image)
        ? image[0]
        : (image as string);

  return (
    <section className="relative isolate flex flex-col">
      {/* Image — always fills the full width. aspect-[3/2] matches the natural
          ratio of our venue photos so they fit without top/bottom crop on the
          most common viewports; ultrawide screens see a very minor side crop. */}
      <div className="relative w-full bg-forest aspect-[3/2] max-h-[80vh] min-h-[360px] overflow-hidden">
        {useSlider ? (
          <HeroSlider images={sliderImages.map((s) => ({ src: s.src }))} />
        ) : imageKey ? (
          <DisplayImage
            k={imageKey}
            fallback={singleSrc}
            aspect="3/2"
            className="h-full"
          />
        ) : (
          <Image
            src={singleSrc}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        {/* Subtle top shade so the sticky nav stays legible over light photos */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-forestDeep/55 to-transparent" />
      </div>

      {/* Copy — clean hard edge between image and title band */}
      <div className="flex flex-col items-center justify-center bg-forest px-6 py-10 text-center md:py-14">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-eyebrow text-plonkYellow">
            {eyebrowKey ? <Editable k={eyebrowKey}>{eyebrow}</Editable> : eyebrow}
          </p>
        )}
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
          {titleKey ? <Editable k={titleKey}>{title}</Editable> : title}
        </h1>
        {intro && (
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-cream/85 sm:text-lg">
            {introKey ? (
              <Editable k={introKey} multiline>{intro}</Editable>
            ) : (
              intro
            )}
          </p>
        )}

        {/* In-page admin shortcut to the hero slider's gallery — only
            visible when admin Edit mode is on, only when this hero
            has a sliderKey wired. */}
        {sliderKey && (
          <ManageGalleryLink galleryKey={sliderKey} label="Manage hero slider images / order" />
        )}
      </div>
    </section>
  );
}
