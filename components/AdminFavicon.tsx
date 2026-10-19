"use client";

import { useEffect } from "react";
import { useEditMode } from "@/lib/editMode";

// When an editor turns ON "edit on page" mode, recolour the browser-tab
// favicon's right die from brand red to plonkTeal (#1ec8b8) — the same teal
// as the EDIT ON PAGE button — so admin/edit tabs are instantly tellable from
// normal tabs (founder, 18 Oct 2026). Reverts to the red dice when off.
// Mirrors app/icon.svg exactly, swapping only the right die's fill.
const ndFavicon = (dieFill: string): string =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="No Dice">` +
      `<rect width="64" height="64" rx="12" fill="#000000"/>` +
      `<g transform="translate(7 17) rotate(-9 12 15)">` +
      `<rect width="26" height="26" rx="5" fill="#F5EFE3"/>` +
      `<circle cx="8" cy="8" r="2.6" fill="#000000"/>` +
      `<circle cx="18" cy="18" r="2.6" fill="#000000"/></g>` +
      `<g transform="translate(31 21) rotate(11 13 13)">` +
      `<rect width="26" height="26" rx="5" fill="${dieFill}"/>` +
      `<circle cx="7" cy="7" r="2.6" fill="#F5EFE3"/>` +
      `<circle cx="19" cy="7" r="2.6" fill="#F5EFE3"/>` +
      `<circle cx="13" cy="13" r="2.6" fill="#F5EFE3"/>` +
      `<circle cx="7" cy="19" r="2.6" fill="#F5EFE3"/>` +
      `<circle cx="19" cy="19" r="2.6" fill="#F5EFE3"/></g></svg>`,
  );

const RED_FAVICON = ndFavicon("#DA1B33"); // brand red — the default look
const TEAL_FAVICON = ndFavicon("#1ec8b8"); // plonkTeal — admin / editing

export default function AdminFavicon() {
  const editing = useEditMode();

  useEffect(() => {
    const ID = "nd-admin-favicon";
    let link = document.getElementById(ID) as HTMLLinkElement | null;
    if (editing) {
      // Append our override LAST so the browser prefers it over app/icon.svg.
      if (!link) {
        link = document.createElement("link");
        link.id = ID;
        link.rel = "icon";
        link.type = "image/svg+xml";
        document.head.appendChild(link);
      }
      link.href = TEAL_FAVICON;
    } else if (link) {
      // Reliable revert to red (set href rather than removing, so browsers
      // that cache the last favicon still pick up the change).
      link.href = RED_FAVICON;
    }
  }, [editing]);

  return null;
}
