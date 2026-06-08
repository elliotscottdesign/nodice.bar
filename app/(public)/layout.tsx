import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminBar from "@/components/AdminBar";
import { ContentProvider } from "@/lib/content";
import { EditModeProvider } from "@/lib/editMode";

// Customer site lives at staff.nodice.bar — the SUBDOMAIN is the
// gate. Public visitors to nodice.bar see the splash served by the
// separate Plonk-Borough-2.0 deployment; staff bookmark
// staff.nodice.bar and develop with zero friction. Anyone who finds
// staff.nodice.bar in the wild will see the real site, which is
// fine — the domain is not promoted or linked anywhere public.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentProvider>
      <EditModeProvider>
        <div className="bed-page flex min-h-screen flex-col">
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
        <AdminBar />
      </EditModeProvider>
    </ContentProvider>
  );
}
