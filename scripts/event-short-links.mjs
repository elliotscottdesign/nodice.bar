// =============================================================
// Post-build: one real page per upcoming event at nodice.bar/<nameofevent>
// =============================================================
// Runs after `next build` (package.json "postbuild"). For every upcoming
// event it copies out/event/index.html to out/<slug>/index.html and puts that
// event's name, blurb and poster into the page's title + link-preview tags,
// so a shared short link previews properly in WhatsApp / iMessage / Instagram.
// The page itself reads the name from the address bar (lib/eventSlug.ts).
//
// Never fails the build: if the database can't be reached, it logs and stops —
// short links still work through the 404 page (app/not-found.tsx).
// Keep eventSlug() in step with lib/eventSlug.ts.
// =============================================================
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rntcujcpsozvuxvmlejv.supabase.co";
let KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
if (!KEY && fs.existsSync(".env.local")) {
  const m = fs.readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m);
  if (m) KEY = m[1].trim().replace(/^["']|["']$/g, "");
}

const slugOf = (name) =>
  String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/?>`);
  const tag = `<meta ${attr}="${key}" content="${esc(value)}"/>`;
  return re.test(html) ? html.replace(re, tag) : html.replace("</head>", `${tag}</head>`);
}

async function main() {
  const tpl = path.join(OUT, "event", "index.html");
  if (!fs.existsSync(tpl)) return console.log("[short-links] no out/event/index.html — skipped");
  if (!KEY) return console.log("[short-links] no Supabase key — skipped (404 fallback still works)");
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `${URL_}/rest/v1/events?select=id,name,description,event_date,poster_url&event_date=gte.${today}&order=event_date.asc&limit=1000`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
  );
  if (!res.ok) return console.log(`[short-links] events read failed ${res.status} — skipped`);
  const rows = await res.json();
  const base = fs.readFileSync(tpl, "utf8");
  const done = new Set();
  let made = 0;
  for (const ev of rows) {
    const slug = slugOf(ev.name);
    if (!slug || done.has(slug)) continue; // soonest date wins for repeats
    done.add(slug);
    const dir = path.join(OUT, slug);
    if (fs.existsSync(dir) || fs.existsSync(`${dir}.html`)) continue; // a real page wins
    const d = new Date(`${ev.event_date}T12:00:00Z`);
    const when = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    const title = `${ev.name} · ${when} · No Dice`;
    const desc = (ev.description || `${ev.name} at No Dice, London Fields, Hackney.`).replace(/\s+/g, " ").slice(0, 200);
    const url = `https://nodice.bar/${slug}/`;
    let html = base.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
    html = setMeta(html, "name", "description", desc);
    html = setMeta(html, "property", "og:title", title);
    html = setMeta(html, "property", "og:description", desc);
    html = setMeta(html, "property", "og:url", url);
    html = setMeta(html, "name", "twitter:title", title);
    html = setMeta(html, "name", "twitter:description", desc);
    if (ev.poster_url) {
      // Drop the site-wide preview image(s), then put the poster in.
      html = html.replace(/<meta (property|name)="(og|twitter):image(:[a-z_]+)?" content="[^"]*"\s*\/?>/g, "");
      html = setMeta(html, "property", "og:image", ev.poster_url);
      html = setMeta(html, "name", "twitter:image", ev.poster_url);
    }
    html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}"/>`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    made++;
  }
  console.log(`[short-links] wrote ${made} event pages (${done.size} names)`);
}

main().catch((e) => console.log("[short-links] skipped:", e?.message || e));
