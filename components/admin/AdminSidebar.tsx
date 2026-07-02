"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "./AdminGate";

// Sidebar organised into 5 groups (2026-07-02):
//   Today     — what's happening now
//   Bookings  — customer-facing reservations
//   Events    — what appears on the site
//   Money     — moving money in/out
//   Setup     — venue configuration (rarely touched)
const NAV: { label: string; href: string; group?: string }[] = [
  { label: "Dashboard", href: "/admin", group: "Today" },
  { label: "Booking Calendar", href: "/admin/calendar", group: "Today" },

  { label: "Golf Bookings", href: "/admin/bookings", group: "Bookings" },
  { label: "Table reservations", href: "/admin/table-reservations", group: "Bookings" },
  { label: "Pool reservations", href: "/admin/pool-reservations", group: "Bookings" },
  { label: "Tournament entries", href: "/admin/tournament-entries", group: "Bookings" },

  { label: "Events", href: "/admin/events", group: "Events" },
  { label: "Site Content", href: "/admin/content", group: "Events" },
  { label: "Header", href: "/admin/content/global/header", group: "Events" },
  { label: "Footer", href: "/admin/content/global/footer", group: "Events" },
  { label: "Galleries", href: "/admin/content/galleries", group: "Events" },
  { label: "Media library", href: "/admin/media", group: "Events" },
  { label: "Email Templates", href: "/admin/emails", group: "Events" },

  { label: "Customers", href: "/admin/customers", group: "Money" },
  { label: "Refunds", href: "/admin/refunds", group: "Money" },
  { label: "Promo Codes", href: "/admin/promos", group: "Money" },
  { label: "Vouchers", href: "/admin/vouchers", group: "Money" },

  { label: "Tickets & Prices", href: "/admin/tickets", group: "Setup" },
  { label: "Add-ons", href: "/admin/addons", group: "Setup" },
  { label: "Opening Hours", href: "/admin/hours", group: "Setup" },
  { label: "Closed Dates", href: "/admin/closed", group: "Setup" },
  { label: "Slot Capacity", href: "/admin/slots", group: "Setup" },
];

const GROUPS = ["Today", "Bookings", "Events", "Money", "Setup"];

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
          No Dice Admin
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
                          ? "bg-plonkTeal/15 text-cream"
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
