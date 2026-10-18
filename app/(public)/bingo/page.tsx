"use client";

import { useEffect } from "react";
import Link from "next/link";

// The Comedy & Bingo page moved from /bingo to /comedybingo (founder, 18 Oct
// 2026). This stub keeps the old address alive — printed QR codes and shared
// links that point at /bingo land here and bounce straight on, so nothing that
// was already handed out breaks. Static export can't do a server redirect, so
// we do it client-side with a <meta> fallback for no-JS.
const TARGET =
  (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/comedybingo";

export default function BingoRedirect() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${TARGET}`} />
      <main
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p>
          Taking you to our Comedy &amp; Bingo night…{" "}
          <Link href="/comedybingo">tap here if nothing happens</Link>.
        </p>
      </main>
    </>
  );
}
