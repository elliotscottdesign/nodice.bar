import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminBar from "@/components/AdminBar";
import { ContentProvider } from "@/lib/content";
import { EditModeProvider } from "@/lib/editMode";

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
