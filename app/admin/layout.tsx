import type { Metadata } from "next";
import AdminGate from "@/components/admin/AdminGate";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const metadata: Metadata = {
  title: "No Dice Admin",
  robots: { index: false, follow: false },
  // Teal dice favicon for the whole /admin section so admin tabs are
  // tellable from customer tabs at a glance (founder, 18 Oct 2026). Overrides
  // the root red /nodice-logo.png icon for these routes.
  icons: {
    icon: "/nodice-admin-icon.svg",
    shortcut: "/nodice-admin-icon.svg",
    apple: "/nodice-admin-icon.svg",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGate>
      <div className="flex min-h-screen bg-ink text-cream">
        <AdminSidebar />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
        </main>
      </div>
    </AdminGate>
  );
}
