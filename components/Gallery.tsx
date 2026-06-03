import Image from "next/image";

export default function Gallery({
  heading,
  intro,
  images,
  tint = "tint-forest",
}: {
  heading?: string;
  intro?: string;
  images: { src: string; alt: string }[];
  tint?: string;
}) {
  if (images.length === 0) return null;
  return (
    <section className={tint}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        {heading && (
          <h2 className="text-center font-display text-3xl sm:text-4xl">
            {heading}
          </h2>
        )}
        {intro && (
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-cream/70">
            {intro}
          </p>
        )}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
          {images.map((img, i) => (
            <div
              key={img.src}
              className={`relative overflow-hidden rounded-xl ${
                i % 7 === 0 ? "aspect-square sm:col-span-2 sm:row-span-2 sm:aspect-square" : "aspect-square"
              }`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover transition duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
