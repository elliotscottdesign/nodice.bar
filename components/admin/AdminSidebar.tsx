"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "./AdminGate";

const NAV: { label: string; href: string; group?: string }[] = [
  { label: "Dashboard", href: "/admin", group: "Overview" },
  { label: "Bookings", href: "/admin/bookings", group: "Overview" },
  { label: "Calendar", href: "/admin/bookings/calendar", group: "Overview" },
  { label: "Customers", href: "/admin/customers", group: "Overview" },

  { label: "Site Content", href: "/admin/content", group: "Site" },
  { label: "Header", href: "/admin/content/global/header", group: "Site" },
  { label: "Footer", href: "/admin/content/global/footer", group: "Site" },
  { label: "Galleries", href: "/admin/content/galleries", group: "Site" },

  { label: "Tickets & Prices", href: "/admin/tickets", group: "Catalogue" },
  { label: "Add-ons", href: "/admin/addons", group: "Catalogue" },

  { label: "Opening Hours", href: "/admin/hours", group: "Availability" },
  { label: "Closed Dates", href: "/admin/closed", group: "Availability" },
  { label: "Slot Capacity", href: "/admin/slots", group: "Availability" },

  { label: "Vouchers", href: "/admin/vouchers", group: "Discounts" },
  { label: "Promo Codes", href: "/admin/promos", group: "Discounts" },

  { label: "Refunds", href: "/admin/refunds", group: "Operations" },
  { label: "Email Templates", href: "/admin/emails", group: "Operations" },
];

const GROUPS = [
  "Overview",
  "Site",
  "Catalogue",
  "Availability",
  "Discounts",
  "Operations",
];

export default function AdminSidebar() {
  const pathname = usePathname() || "";
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
    return pathname.startsWith(href);
  }

  function handleLogout() {
    logout();
    router.refresh();
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-cream/10 bg-ink/80 md:flex md:flex-col">
      <div className="border-b border-cream/10 p-5">
        <Link href="/admin" className="font-display text-xl">
          Plonk Admin
        </Link>
        <p className="mt-1 text-xs text-cream/50">Preview / pre-backend</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 text-sm">
        {GROUPS.map((g) => {
          const items = NAV.filter((n) => n.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g} className="mb-5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cream/40">
                {g}
              </p>
              <ul className="mt-2 space-y-0.5">
                {items.map((n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className={`block rounded-md px-3 py-1.5 transition ${
                        isActive(n.href)
                          ? "bg-plonkPink/15 text-cream"
                          : "text-cream/70 hover:bg-cream/5 hover:text-cream"
                      }`}
                    >
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-cream/10 p-3">
        <Link
          href="/"
          className="block rounded-md px-3 py-1.5 text-xs text-cream/60 hover:text-cream"
        >
          ← Back to public site
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 block w-full rounded-md px-3 py-1.5 text-left text-xs text-cream/60 hover:text-cream"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
