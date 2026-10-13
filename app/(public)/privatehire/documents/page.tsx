"use client";

import Link from "next/link";
import { useEffect } from "react";

// /privatehire/documents → /parties/documents (permanent redirect
// stub). The gated corporate-documents page moved with the
// /privatehire → /parties rename (founder, Oct 2026). Old links kept
// alive here. Static export → client-side redirect, same pattern as
// the /privatehire stub.
export default function PrivateHireDocumentsRedirect() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    window.location.replace(`${basePath}/parties/documents`);
  }, [basePath]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <meta httpEquiv="refresh" content={`0; url=${basePath}/parties/documents`} />
      <h1 className="font-display text-3xl uppercase tracking-wider">
        This page has moved
      </h1>
      <p className="mt-3 text-sm text-cream/70">
        Corporate documents now live at /parties/documents. Taking you there…
      </p>
      <Link
        href="/parties/documents"
        className="mt-6 inline-block rounded-full bg-plonkPink px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-plonkPink/90"
      >
        Go to documents
      </Link>
    </main>
  );
}
