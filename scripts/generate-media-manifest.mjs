// =============================================================
// Plonk Golf — media manifest generator
// =============================================================
// Walks public/ at build time and writes public/media-manifest.json,
// a tree of every image grouped by folder. The admin "Pick from
// library" picker fetches this file at runtime so editors can swap
// images in the CMS without knowing exact paths.
//
// Runs automatically before every build via the "prebuild" npm
// script. Re-run locally with: node scripts/generate-media-manifest.mjs
// =============================================================

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = join(__filename, "..", "..");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
// Folders inside public/ to skip — these aren't user-facing media.
const SKIP_DIRS = new Set(["plonk"]);

function listImagesRecursively(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      results.push(...listImagesRecursively(fullPath));
      continue;
    }
    const ext = entry.toLowerCase().slice(entry.lastIndexOf("."));
    if (!EXTENSIONS.has(ext)) continue;
    // Always emit POSIX-style paths so they work in URLs regardless
    // of the build OS.
    const rel = "/" + relative(PUBLIC_DIR, fullPath).split(/[\\/]/).join(posix.sep);
    results.push({
      path: rel,
      size: stat.size,
      // Friendly folder label — "borough/course" rather than the
      // full path — used by the picker to group thumbnails.
      folder: posix.dirname(rel).replace(/^\/+/, "") || "root",
      filename: posix.basename(rel),
    });
  }
  return results;
}

const images = listImagesRecursively(PUBLIC_DIR).sort((a, b) =>
  a.path < b.path ? -1 : 1,
);

const manifest = {
  generated_at: new Date().toISOString(),
  count: images.length,
  images,
};

const outPath = join(PUBLIC_DIR, "media-manifest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`media-manifest.json: ${images.length} images written to ${outPath}`);
