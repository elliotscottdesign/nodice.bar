import type { MetadataRoute } from "next";

// =============================================================
// /sitemap.xml — generated at build time from this file
// =============================================================
// Lists every page Google should crawl. The customer site moves to
// nodice.bar at launch — the URLs stay correct because we use the
// SITE_URL constant. Admin pages, booking flows that need DB lookups,
// and confirmation/success URLs are excluded — they're transient,
// not landing pages.
// =============================================================

const SITE_URL = "https://nodice.bar";

export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date().toISOString().slice(0, 10);

  const publicRoutes: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/bar", priority: 0.9, changeFrequency: "weekly" },
    { path: "/pool", priority: 0.9, changeFrequency: "weekly" },
    { path: "/worldcup", priority: 0.9, changeFrequency: "daily" },
    { path: "/events", priority: 0.9, changeFrequency: "daily" },
    { path: "/deals", priority: 0.8, changeFrequency: "weekly" },
    { path: "/privatehire", priority: 0.7, changeFrequency: "monthly" },
    // Mini-golf coming-soon landing — replaces the previous external
    // Plonk Golf link in the header. Email-capture page until the
    // course opens.
    { path: "/minigolf", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
    { path: "/book/pool", priority: 0.8, changeFrequency: "weekly" },
    { path: "/book/table", priority: 0.8, changeFrequency: "weekly" },
    { path: "/faqs", priority: 0.6, changeFrequency: "monthly" },
    { path: "/vouchers", priority: 0.6, changeFrequency: "monthly" },
    { path: "/snackbar", priority: 0.6, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

  return publicRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: today,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
