import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import NewsletterPopup from "@/components/NewsletterPopup";

// =============================================================
// Canonical site URL — used by metadataBase + structured data
// =============================================================
// Once we flip the customer site from dev.nodice.bar to nodice.bar
// at launch, this stays the same — the schema points at the real
// public URL so Google indexes the bar with the right canonical.
const SITE_URL = "https://nodice.bar";

const VENUE = {
  name: "No Dice",
  legalName: "No Dice Hackney Ltd",
  description:
    "A neighbourhood bar in the railway arches off London Fields. American pool tables, arcade machines, kitchen residencies, big screens for sport.",
  streetAddress: "Arch 407, Mentmore Terrace",
  locality: "London Fields, Hackney",
  region: "London",
  postcode: "E8 3PH",
  country: "GB",
  // Coordinates for Mentmore Terrace, London Fields — used by Google
  // Maps + the local-pack ranking signal.
  latitude: 51.5417,
  longitude: -0.0561,
  priceRange: "££",
  email: "info@nodice.bar",
};

// =============================================================
// Global metadata — applies to every page unless a route overrides
// =============================================================
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "No Dice — London Fields, Hackney",
    template: "%s · No Dice",
  },
  description:
    "No Dice — a neighbourhood bar in the railway arches off London Fields. Pool tables, arcade, kitchen residencies, big screens for sport. Opens 17 June 2026.",
  applicationName: VENUE.name,
  authors: [{ name: VENUE.legalName }],
  keywords: [
    "Hackney bar",
    "London Fields bar",
    "pool table Hackney",
    "American pool London",
    "sports bar Hackney",
    "World Cup bar London",
    "DJ nights Hackney",
    "Mentmore Terrace",
    "No Dice",
  ],
  openGraph: {
    type: "website",
    siteName: VENUE.name,
    url: SITE_URL,
    title: "No Dice — London Fields, Hackney",
    description:
      "Pool tables, arcade, kitchen residencies, big screens for sport. 407 Mentmore Terrace, E8 3PH.",
    locale: "en_GB",
    images: [
      {
        url: "/nodice-wordmark.png",
        width: 1200,
        height: 630,
        alt: "No Dice — London Fields, Hackney",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "No Dice — London Fields, Hackney",
    description:
      "Pool tables, arcade, kitchen residencies, big screens for sport. 407 Mentmore Terrace, E8 3PH.",
    images: ["/nodice-wordmark.png"],
  },
  robots: {
    // Block dev.nodice.bar from being indexed while it's the
    // pre-launch URL. At launch, flip these to true (or just delete
    // the `robots:` block — Next defaults to indexable).
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// =============================================================
// JSON-LD structured data
// =============================================================
// Tells Google + every other search engine "this URL is the
// canonical home of a bar at this address, these hours, these
// social profiles." Drives the local pack on Google Maps and
// rich snippets in Search.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "BarOrPub",
  "@id": `${SITE_URL}#bar`,
  name: VENUE.name,
  description: VENUE.description,
  url: SITE_URL,
  email: VENUE.email,
  image: `${SITE_URL}/nodice-wordmark.png`,
  priceRange: VENUE.priceRange,
  address: {
    "@type": "PostalAddress",
    streetAddress: VENUE.streetAddress,
    addressLocality: VENUE.locality,
    addressRegion: VENUE.region,
    postalCode: VENUE.postcode,
    addressCountry: VENUE.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: VENUE.latitude,
    longitude: VENUE.longitude,
  },
  // Conservative default hours — bookable_products is the live
  // source of truth in admin. Update these here when set in stone.
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "16:00",
      closes: "23:30",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Friday", "Saturday"],
      opens: "16:00",
      closes: "01:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Sunday",
      opens: "16:00",
      closes: "22:30",
    },
  ],
  sameAs: [
    "https://www.instagram.com/nodice.bar/",
    "https://www.facebook.com/pages/NO%20DICE-Golf/749762088452016",
  ],
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "American pool tables" },
    { "@type": "LocationFeatureSpecification", name: "Arcade machines" },
    { "@type": "LocationFeatureSpecification", name: "Big screens for sport" },
    { "@type": "LocationFeatureSpecification", name: "Kitchen residencies" },
    { "@type": "LocationFeatureSpecification", name: "Board games" },
    { "@type": "LocationFeatureSpecification", name: "Wheelchair accessible" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* JSON-LD structured data — renders on every page so Google
            sees the venue context regardless of crawl entry point. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(STRUCTURED_DATA),
          }}
        />
      </head>
      <body>
        {children}
        <CookieConsent />
        <NewsletterPopup />
      </body>
    </html>
  );
}
