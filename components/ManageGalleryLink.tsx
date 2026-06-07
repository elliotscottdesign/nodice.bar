"use client";

import Link from "next/link";
import { useEditMode } from "@/lib/editMode";

// Shows a pink "Manage these images →" button on the live page,
// but ONLY when admin Edit mode is on. Lets the admin jump from
// any gallery section straight to the matching admin gallery
// editor without having to remember URLs.
//
// Mount one inside any section that's gallery-driven:
//   <ManageGalleryLink galleryKey="hackney.events" />
//
// The link points at the central galleries page with the chosen
// gallery pre-selected via a ?gallery=… query string. The
// GalleriesAdminClient reads this on mount and switches its
// sidebar to the matching tab.
export default function ManageGalleryLink({
  galleryKey,
  label,
}: {
  galleryKey: string;
  label?: string;
}) {
  const editing = useEditMode();
  if (!editing) return null;
  return (
    // Absolutely positioned so it floats over the bottom-right of the
    // nearest `relative` ancestor (typically the media container —
    // hero slider, gallery grid, etc.). When in admin Edit mode this
    // makes it obvious which media each pill controls without pushing
    // the page layout around.
    // `pointer-events-auto` is belt-and-braces in case the parent
    // disables them for a hover overlay; the link itself must always
    // be clickable.
    <Link
      href={`/admin/content/galleries/?gallery=${encodeURIComponent(galleryKey)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-full bg-plonkTeal/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-plonkTeal/30 backdrop-blur-sm hover:bg-plonkTeal"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" />
        <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
      </svg>
      {label ?? "Manage images"}
    </Link>
  );
}
