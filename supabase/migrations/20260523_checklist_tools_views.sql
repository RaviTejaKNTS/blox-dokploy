-- Checklist and tools views to centralize render-friendly fields

-- Checklist view with item counts and universe info
drop view if exists public.checklist_pages_view;
create or replace view public.checklist_pages_view as
with item_stats as (
  select
    page_id,
    count(*) as item_count,
    max(updated_at) as latest_item_at
  from public.checklist_items
  group by page_id
)
select
  cp.*,
  coalesce(stats.item_count, 0) as item_count,
  coalesce(stats.latest_item_at, cp.updated_at) as content_updated_at,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name,
    'icon_url', u.icon_url,
    'thumbnail_urls', u.thumbnail_urls
  ) end as universe
from public.checklist_pages cp
left join item_stats stats on stats.page_id = cp.id
left join public.roblox_universes u on u.universe_id = cp.universe_id;

-- Tools view to keep published flags and core content together
drop view if exists public.tools_view;
create or replace view public.tools_view as
select
  t.*,
  greatest(t.updated_at, coalesce(t.published_at, t.updated_at)) as content_updated_at
from public.tools t;
