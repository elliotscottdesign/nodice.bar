// =============================================================
// No Dice — public image CDN helper
// =============================================================
// WHY THIS EXISTS
// Our public images live in the Supabase Storage `media` bucket and
// used to be served straight off their raw public URLs. Supabase's
// public bucket has NO edge cache, so every customer re-downloaded the
// full-size PNG on every page view — all of it counting against the
// project's metered egress quota. In Nov 2026 that quota tipped over
// and the WHOLE Supabase project got restricted (every login + the
// public site went down). This helper is the permanent fix.
//
// WHAT IT DOES
// `mediaUrl(src, { w, q })` rewrites a Supabase (or any http) image URL
// so it is fetched through wsrv.nl (images.weserv.nl) — a free,
// no-account, edge-cached image proxy. wsrv fetches our Supabase URL
// ONCE, then serves a resized WebP copy from its own global CDN on
// every repeat view. So after the first hit, Supabase egress for that
// image drops to ~zero, and customers get a much smaller WebP instead
// of a multi-megabyte PNG.
//
// HOW TO USE IT
//   import { mediaUrl } from "@/lib/media";
//   <img src={mediaUrl(poster, { w: 800 })} />
// Pick a width that matches how big the image actually renders:
//   hero / full-bleed background → ~1600 (the default)
//   cards / posters in a grid    → ~800
//   small thumbnails             → ~400
// Quality defaults to 75, which is visually clean for WebP.
//
// The helper is SAFE to call on anything: it passes through data:/blob:
// URIs, bundled/relative asset paths, empty values, and URLs that are
// ALREADY routed through the CDN (so it never double-wraps, even if a
// wrapped URL somehow gets stored and re-wrapped later).
// =============================================================

const CDN = "https://wsrv.nl/";

export type MediaOpts = {
  /** Target max width in px. Default 1600 (hero-sized). */
  w?: number;
  /** Target max height in px. Omit to size by width alone. */
  h?: number;
  /** WebP quality 1-100. Default 75. */
  q?: number;
};

/**
 * Route an image URL through the edge-caching, WebP-converting CDN.
 * Returns the input unchanged for anything that can't / shouldn't be
 * proxied (empty, data:/blob:, relative paths, already-CDN'd URLs).
 */
export function mediaUrl(
  src: string | null | undefined,
  opts: MediaOpts = {},
): string {
  if (!src) return "";
  const s = String(src).trim();
  if (!s) return "";

  // Inline data / blob URIs — nothing to fetch, leave them alone.
  if (/^(data:|blob:)/i.test(s)) return s;

  // Relative or root-relative paths (bundled assets served from the
  // site itself, e.g. /nodice-wordmark.png) — not a remote URL the CDN
  // could fetch, and already served from GitHub Pages' own CDN.
  if (!/^https?:\/\//i.test(s)) return s;

  // Idempotent: a URL that's already going through wsrv must never be
  // wrapped a second time (that would ask the CDN to proxy itself).
  if (/^https?:\/\/(www\.)?(wsrv\.nl|images\.weserv\.nl)\b/i.test(s)) return s;

  const { w = 1600, h, q = 75 } = opts;
  const params = new URLSearchParams();
  // URLSearchParams encodes the full https:// URL safely for us.
  params.set("url", s);
  if (w) params.set("w", String(w));
  if (h) params.set("h", String(h));
  params.set("q", String(q));
  params.set("output", "webp");
  // Never upscale past the source's own resolution.
  params.set("we", "1");
  return `${CDN}?${params.toString()}`;
}
