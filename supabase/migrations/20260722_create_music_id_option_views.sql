-- Views for Roblox music ID genres and artists (deduped, slugged, counted)
drop view if exists public.roblox_music_genres_view;
create or replace view public.roblox_music_genres_view as
with normalized as (
  select
    trim(genre) as label,
    regexp_replace(
      trim(
        regexp_replace(replace(lower(trim(genre)), '&', 'and'), '[^a-z0-9]+', ' ', 'g')
      ),
      '\s+',
      '-',
      'g'
    ) as slug
  from public.roblox_music_ids
  where genre is not null
    and trim(genre) <> ''
)
select
  slug,
  (array_agg(label order by length(label) desc, label asc))[1] as label,
  count(*)::int as item_count
from normalized
where slug <> ''
group by slug;

drop view if exists public.roblox_music_artists_view;
create or replace view public.roblox_music_artists_view as
with normalized as (
  select
    trim(artist) as label,
    regexp_replace(
      trim(
        regexp_replace(replace(lower(trim(artist)), '&', 'and'), '[^a-z0-9]+', ' ', 'g')
      ),
      '\s+',
      '-',
      'g'
    ) as slug
  from public.roblox_music_ids
  where artist is not null
    and trim(artist) <> ''
)
select
  slug,
  (array_agg(label order by length(label) desc, label asc))[1] as label,
  count(*)::int as item_count
from normalized
where slug <> ''
group by slug;
