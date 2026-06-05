import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import NewsletterPopup from "@/components/NewsletterPopup";

export const metadata: Metadata = {
  title: "No Dice — London Fields, Hackney",
  description:
    "No Dice — a neighbourhood bar in the railway arches off London Fields. Pool, arcade, kitchen residencies, big screens for sport.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Force browsers to re-validate HTML on every visit so they always
            pick up the latest cache-busted image URLs on a fresh deploy.    */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Bebas Neue (display) + Inter (body) — the dive-bar / band-
            flyer pairing. Bebas is single-weight all-caps condensed;
            it carries every heading and brand moment. Inter handles
            body copy, nav, forms, admin — anywhere readability matters
            more than personality. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
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
