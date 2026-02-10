-- Add universe_id to catalog_pages and refresh catalog_pages_view

alter table if exists public.catalog_pages
  add column if not exists universe_id bigint references public.roblox_universes(universe_id) on delete set null;

create index if not exists idx_catalog_pages_universe_id on public.catalog_pages (universe_id);

drop view if exists public.catalog_pages_view;
create or replace view public.catalog_pages_view as
select
  cp.*,
  greatest(cp.updated_at, coalesce(cp.published_at, cp.updated_at)) as content_updated_at
from public.catalog_pages cp;
