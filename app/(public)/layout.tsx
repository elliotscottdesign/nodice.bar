import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminBar from "@/components/AdminBar";
import ComingSoonGate from "@/components/ComingSoonGate";
import { ContentProvider } from "@/lib/content";
import { EditModeProvider } from "@/lib/editMode";

// Splash gate — public visitors see "OPENS 17 JUNE" instead of the
// real site until they pass the preview code in a URL param.
// /admin/* is auto-unlocked from inside the gate.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <ComingSoonGate>
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
      </ComingSoonGate>
    </Suspense>
  );
}
