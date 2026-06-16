import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminBar from "@/components/AdminBar";
import { ContentProvider } from "@/lib/content";
import { EditModeProvider } from "@/lib/editMode";

// Customer site lives at nodice.bar (apex). The dev.nodice.bar
// subdomain is kept pointing at the same build as a staging mirror
// so staff bookmarks survive — but the canonical surface for
// search engines, OG previews, and every customer link is the apex.
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
