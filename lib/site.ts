// Which site this codebase renders as. Used to scope every read/write
// against shared Supabase tables (page_content, gallery_images) so
// No Dice's CMS content doesn't collide with Plonk's, and vice versa.
//
// Both sites share ONE Supabase project (rntcujcpsozvuxvmlejv) so
// bookings, tickets and availability are a single source of truth.
// But marketing copy, nav, footer, hero images etc. are per-site —
// every row in page_content and gallery_images carries a `site`
// column that segments the two brands.
//
// nodice.bar → SITE = "nodice"
// plonkgolf.co.uk → SITE = "plonk"
export const SITE = "nodice";
