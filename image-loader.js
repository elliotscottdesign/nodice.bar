// next/image with `unoptimized: true` doesn't apply basePath on static export.
// A custom loader is the official workaround — Next.js calls this for every
// <Image> src and uses our return value as the final URL.
//
// We ALSO append a per-deploy build hash (?v=<sha>) so every fresh deploy
// produces fresh image URLs. This prevents the classic GitHub Pages problem
// where a browser caches a 404 from the brief window during deploy when an
// image is referenced in HTML but not yet uploaded — once we deploy again the
// URL is new, the cached 404 doesn't apply, and the browser fetches fresh.
const BASE_PATH = process.env.GITHUB_PAGES === "true" ? "/nodice.bar" : "";
const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_ID || "";

// Edge-caching image CDN. Remote images (Supabase Storage etc.) are routed
// through wsrv.nl so they're fetched ONCE then served as cached, resized WebP
// — this is what keeps Supabase egress flat no matter how many customers load
// the page. This mirrors lib/media.ts's mediaUrl() (the canonical version used
// by plain <img> tags); kept inline here so the loader stays dependency-free.
// next/image hands us the exact responsive `width` for each srcset entry, so we
// get correctly-sized variants for free.
function cdnImage(src, width, quality) {
  // Idempotent — never wrap a URL that's already on the CDN.
  if (/^https?:\/\/(www\.)?(wsrv\.nl|images\.weserv\.nl)\b/i.test(src)) return src;
  const params = new URLSearchParams();
  params.set("url", src);
  if (width) params.set("w", String(width));
  params.set("q", String(quality || 75));
  params.set("output", "webp");
  params.set("we", "1"); // never upscale past the source resolution
  return `https://wsrv.nl/?${params.toString()}`;
}

export default function imageLoader({ src, width, quality }) {
  // Remote URLs → route through the edge CDN (cached, resized WebP).
  if (/^https?:\/\//.test(src)) return cdnImage(src, width, quality);
  const prefix = src.startsWith("/") ? "" : "/";
  const url = `${BASE_PATH}${prefix}${src}`;
  if (!BUILD_HASH) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${BUILD_HASH}`;
}
