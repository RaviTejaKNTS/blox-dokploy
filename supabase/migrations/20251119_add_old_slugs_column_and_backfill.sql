-- Add old_slugs column to games for tracking legacy URLs
alter table if exists public.games
  add column if not exists old_slugs text[] not null default '{}'::text[];

-- Ensure a GIN index exists for quick lookups by legacy slugs
create index if not exists idx_games_old_slugs on public.games using gin (old_slugs);

-- Backfill old_slugs with the current slug value when empty
update public.games
set old_slugs = array_remove(array_append(coalesce(old_slugs, '{}'::text[]), slug), NULL)
where slug is not null
  and (old_slugs is null or array_length(old_slugs, 1) = 0 or not slug = any(old_slugs));

-- Normalize slug values by stripping a trailing "-codes" suffix
with updated as (
  select id,
         slug,
         regexp_replace(slug, '-codes$', '', 'i') as new_slug
  from public.games
  where slug ~* '-codes$'
)
update public.games g
set slug = nullif(u.new_slug, ''),
    updated_at = now()
from updated u
where g.id = u.id
  and g.slug <> u.new_slug;
