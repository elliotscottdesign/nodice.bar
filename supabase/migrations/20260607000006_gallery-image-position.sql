-- =============================================================
-- Gallery images — per-image positioning data
-- =============================================================
-- Each row gets four optional fields the founder can tune from the
-- /admin/content/galleries editor: x/y percentages (0-100) drive
-- CSS object-position, zoom drives a CSS scale() transform, and fit
-- toggles object-fit between cover (default — fills the slot and
-- crops the overflow) and contain (shows the whole image, with
-- letterboxing if the aspect doesn't match).
-- =============================================================

alter table public.gallery_images
  add column if not exists position_x int not null default 50
    check (position_x between 0 and 100);

alter table public.gallery_images
  add column if not exists position_y int not null default 50
    check (position_y between 0 and 100);

alter table public.gallery_images
  add column if not exists position_zoom numeric(4,2) not null default 1.0
    check (position_zoom between 1 and 4);

alter table public.gallery_images
  add column if not exists position_fit text not null default 'cover'
    check (position_fit in ('cover', 'contain'));
