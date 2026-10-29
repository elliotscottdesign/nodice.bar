alter table public.events add column if not exists recurrence_overridden boolean not null default false;
