-- Add nullable universe_id to tools and refresh tools_view

alter table if exists public.tools
  add column if not exists universe_id bigint references public.roblox_universes(universe_id) on delete set null;

-- Recreate tools_view so the new column is exposed
drop view if exists public.tools_view;
create or replace view public.tools_view as
select
  t.*,
  greatest(t.updated_at, coalesce(t.published_at, t.updated_at)) as content_updated_at
from public.tools t;
