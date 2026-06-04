import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import NewsletterPopup from "@/components/NewsletterPopup";

export const metadata: Metadata = {
  title: "No Dice — Crazy Golf Creations Across the Capital",
  description:
    "No Dice Crazy Golf — two original 9-hole courses in London. Hackney and Borough Market. Cocktails, food, arcade and games.",
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
        {/* Lacquer — single weight (400) display face used for both
            headings and body type across the site. Heavier
            font-weight requests (font-semibold, font-bold etc.)
            will fall back to Lacquer 400 since the family ships
            only one cut — accepted trade for the distinctive look. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Lacquer&display=swap"
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
