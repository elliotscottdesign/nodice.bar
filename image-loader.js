// next/image with `unoptimized: true` doesn't apply basePath on static export.
// A custom loader is the official workaround — Next.js calls this for every
// <Image> src and uses our return value as the final URL.
//
// We ALSO append a per-deploy build hash (?v=<sha>) so every fresh deploy
// produces fresh image URLs. This prevents the classic GitHub Pages problem
// where a browser caches a 404 from the brief window during deploy when an
// image is referenced in HTML but not yet uploaded — once we deploy again the
// URL is new, the cached 404 doesn't apply, and the browser fetches fresh.
const BASE_PATH = process.env.GITHUB_PAGES === "true" ? "/plonkgolf-website" : "";
const BUILD_HASH = process.env.NEXT_PUBLIC_BUILD_ID || "";

export default function imageLoader({ src }) {
  // Don't touch absolute URLs
  if (/^https?:\/\//.test(src)) return src;
  const prefix = src.startsWith("/") ? "" : "/";
  const url = `${BASE_PATH}${prefix}${src}`;
  if (!BUILD_HASH) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${BUILD_HASH}`;
}
