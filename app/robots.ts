import type { MetadataRoute } from "next";

// =============================================================
// /robots.txt — generated at build time
// =============================================================
// Tells search engine crawlers what they can / can't fetch. Admin
// is explicitly blocked. Sitemap reference at the bottom helps
// Google discover all public routes immediately.
// =============================================================

const SITE_URL = "https://nodice.bar";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/admin",
          "/book/checkout/",
          "/book/success/",
          "/book/tournament/cancelled/",
          "/book/tournament/success/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
