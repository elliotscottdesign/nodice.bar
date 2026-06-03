# Image upload guide — plonk.nodice.bar

Quick reference for whoever's uploading images via `/admin/content/*`.

> **Where this lives in code:** [`lib/imageSpecs.ts`](../lib/imageSpecs.ts) is the
> single source of truth. The admin UI reads it on every page load — change a
> spec there and the "Recommended:" caption next to the relevant upload field
> updates immediately. This document mirrors the registry for humans.

## Headline rules

- **Use pixels, ignore DPI.** Browsers don't care about DPI — only the pixel
  dimensions of the file. Set DPI to whatever, it changes nothing.
- **JPEG for photos**, PNG only if you need transparency (rare). WebP is
  fine too and usually smaller.
- **JPEG quality 75-80** is the sweet spot — visually identical to 100, a
  fraction of the file size.
- **Don't upload bigger than the recommendation.** A 6000×4000 hero image
  isn't sharper than 2400×1600 on a normal screen — it just loads slower
  and eats your Supabase Storage quota.
- **No-faff compressor:** drag any image into [squoosh.app](https://squoosh.app),
  pick MozJPEG quality 75, download.

## The full table

| Location | Shape | Pixel size | Max file size |
|---|---|---|---|
| Homepage hero | Landscape 3:2 | **2400 × 1600** | 300 KB |
| Hackney venue hero | Landscape 3:2 | **2400 × 1600** | 300 KB |
| Borough venue hero | Landscape 3:2 | **2400 × 1600** | 300 KB |
| All other page heroes (About, Contact, FAQs, Terms, Privacy) | Landscape 3:2 | **2400 × 1600** | 300 KB |
| Private hire — Hackney card | Landscape 4:3 | **1200 × 900** | 200 KB |
| Private hire — Borough card | Landscape 4:3 | **1200 × 900** | 200 KB |
| Homepage "More than mini-golf" feature cards (×4) | Landscape 5:3 | **1000 × 600** | 150 KB |
| Homepage venue spotlight portrait | Portrait 4:5 | **1200 × 1500** | 250 KB |
| Venue page mid-section portraits | Portrait 4:5 | **1200 × 1500** | 250 KB |
| About-page in-line photos | Landscape 4:3 | **1200 × 900** | 200 KB |
| /book venue picker tiles | Landscape 4:3 | **1200 × 900** | 200 KB |
| About gallery (12-image strip at the bottom) | Square 1:1 | **1200 × 1200** | 200 KB |
| Hackney gallery | Square 1:1 | **1200 × 1200** | 200 KB |
| Borough gallery | Square 1:1 | **1200 × 1200** | 200 KB |
| Hackney "Events at No Dice" posters | Portrait 5:7 | **1000 × 1400** | 200 KB |
| Newsletter popup image | Portrait 4:5 | **1000 × 1250** | 150 KB |
| Snack Bar background | Landscape | **2400 × 1400** | 300 KB |

## The "master rule" — what happens for new image slots

When a new image location is added (e.g. someone registers a new
`page_content` row with `field_kind = 'image'`, or a new
`gallery_key` is created in `gallery_images`):

1. If the developer adds an entry for it in
   [`lib/imageSpecs.ts`](../lib/imageSpecs.ts) under `EXPLICIT_SPECS`,
   the admin shows the exact recommendation defined there.

2. If not, `getImageSpec()` falls back to **pattern matching on the key**:
   - `*.hero_image`, `*.hero` → hero (3:2, 2400×1600)
   - `*.gallery`, `*.gallery.*` → square gallery photo (1200×1200)
   - `*.features` → feature card (5:3, 1000×600)
   - `*.poster`, `*events*` → event poster portrait (5:7)
   - `*.background`, `*.bg` → full-bleed landscape
   - `*.portrait` → portrait 4:5
   - `*.card`, `*.thumb` → 4:3 card

3. If the key matches none of those, a generic landscape default is
   shown with an inline note **highlighted in yellow** asking the
   developer to register a proper spec. The user still gets *some*
   guidance — they're never left flying blind.

So the workflow is:
- **Add image slot → add spec → caption appears automatically.**
- Forget to add the spec? The admin still shows guidance (yellow,
  inferred) and prompts whoever sees it to ping the dev to register
  it properly.

## Adding a new spec

Edit `lib/imageSpecs.ts`, add one line to `EXPLICIT_SPECS`:

```ts
"venue.hackney.kitchen_image": LANDSCAPE_43_SPEC,
```

(or use one of the other reusable specs at the top of the file, or
define a brand new one inline). Save, commit, push — the caption
appears in the admin within a minute.
