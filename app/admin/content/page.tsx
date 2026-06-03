import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

export const metadata = { title: "Site Content — Plonk Admin" };

const PAGES: { label: string; href: string; description: string; group: string }[] = [
  {
    group: "Marketing",
    label: "Home page",
    href: "/admin/content/home",
    description: "Hero headline, sub-copy, hero image, venue card blurbs.",
  },
  {
    group: "Marketing",
    label: "Hackney venue page",
    href: "/admin/content/venue/hackney",
    description: "Title, intro, body copy, hero image for /venue/hackney.",
  },
  {
    group: "Marketing",
    label: "Borough Market venue page",
    href: "/admin/content/venue/borough",
    description: "Title, intro, body copy, hero image for /venue/borough-market.",
  },
  {
    group: "Private hire",
    label: "Private hire — overview",
    href: "/admin/content/private-hire",
    description: "Headline + body for /private-hire.",
  },
  {
    group: "Private hire",
    label: "Private hire — Hackney",
    href: "/admin/content/private-hire/hackney",
    description: "Headline + body for /private-hire/hackney.",
  },
  {
    group: "Private hire",
    label: "Private hire — Borough Market",
    href: "/admin/content/private-hire/borough",
    description: "Headline + body for /private-hire/borough-market.",
  },
  {
    group: "Info pages",
    label: "About",
    href: "/admin/content/info/about",
    description: "Copy on /about.",
  },
  {
    group: "Info pages",
    label: "Contact",
    href: "/admin/content/info/contact",
    description: "Copy on /contact.",
  },
  {
    group: "Info pages",
    label: "FAQs",
    href: "/admin/content/info/faqs",
    description: "Title + intro on /faqs.",
  },
  {
    group: "Info pages",
    label: "Snack Bar",
    href: "/admin/content/info/snack-bar",
    description: "Copy on /snack-bar.",
  },
  {
    group: "Info pages",
    label: "Terms",
    href: "/admin/content/info/terms",
    description: "Copy on /terms.",
  },
  {
    group: "Info pages",
    label: "Privacy",
    href: "/admin/content/info/privacy",
    description: "Copy on /privacy.",
  },
  {
    group: "Info pages",
    label: "Events",
    href: "/admin/content/info/events",
    description: "Event listings shown on /events. Add, edit, delete by venue.",
  },
  {
    group: "Info pages",
    label: "Deals",
    href: "/admin/content/info/deals",
    description: "Off-peak deals shown on /deals.",
  },
  {
    group: "Info pages",
    label: "Vouchers",
    href: "/admin/content/info/vouchers",
    description: "Copy + perk blurbs on /vouchers.",
  },

  {
    group: "Media",
    label: "Galleries",
    href: "/admin/content/galleries",
    description: "Photo grids across the site — homepage features + press logos, about, venue galleries, Hackney events posters.",
  },

  {
    group: "Site-wide",
    label: "Header",
    href: "/admin/content/global/header",
    description: "Logo, nav links and the Book Now button — everything in the sticky top bar.",
  },
  {
    group: "Site-wide",
    label: "Footer",
    href: "/admin/content/global/footer",
    description: "Brand block, venue addresses, social links, copyright.",
  },
];

const GROUPS = ["Marketing", "Private hire", "Info pages", "Media", "Site-wide"];

export default function ContentLandingPage() {
  return (
    <>
      <AdminPageHeader
        title="Site Content"
        description="Edit the text and images shown on the public site. Changes save to the database and appear on the live site within a minute of saving — no developer needed."
      />

      <div className="space-y-8">
        {GROUPS.map((g) => {
          const items = PAGES.filter((p) => p.group === g);
          return (
            <section key={g}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-plonkYellow">
                {g}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-2xl border border-cream/10 bg-ink/40 p-5 transition hover:border-plonkPink/60 hover:bg-cream/5"
                  >
                    <p className="font-display text-lg">{item.label}</p>
                    <p className="mt-1 text-xs text-cream/60">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <AdminCard>
        <p className="px-5 py-4 text-xs text-cream/55">
          Don't see a page or field you need to edit? Add a row to the{" "}
          <code>page_content</code> table in Supabase (or message the dev) and
          it'll appear here.
        </p>
      </AdminCard>
    </>
  );
}
