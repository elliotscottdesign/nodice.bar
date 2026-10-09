"use client";

import { useContent } from "@/lib/content";
import { Editable } from "@/components/Editable";

// EditableText — drop-in CMS-editable text for any string on a page.
// Reads the live value for `k` (falling back to `fallback`) and wraps it
// in <Editable> so an admin in Edit mode can click and type in place, the
// same system every other nodice.bar page uses. Lets a server-rendered
// page (e.g. /xmas) make individual strings editable without becoming a
// client component itself — this island handles the read + edit.
//
//   <EditableText as="h1" k="xmas.hero_title" fallback="Christmas at No Dice" className="…" />
export default function EditableText({
  k,
  fallback,
  as: Tag = "span",
  className,
  multiline = false,
}: {
  k: string;
  fallback: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  className?: string;
  multiline?: boolean;
}) {
  const value = useContent(k, fallback);
  return (
    <Tag className={className}>
      <Editable k={k} multiline={multiline}>
        {value}
      </Editable>
    </Tag>
  );
}
