-- Add thumbnail URL storage for Roblox music IDs
alter table if exists public.roblox_music_ids
  add column if not exists thumbnail_url text;

drop view if exists public.roblox_music_ids_boombox_view;
create or replace view public.roblox_music_ids_boombox_view as
select
  asset_id,
  title,
  artist,
  album,
  genre,
  duration_seconds,
  album_art_asset_id,
  thumbnail_url,
  rank,
  source,
  raw_payload,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at,
  boombox_ready,
  boombox_ready_reason,
  verified_at,
  product_info_json,
  asset_delivery_status,
  vote_count,
  upvote_percent,
  creator_verified,
  popularity_score
from public.roblox_music_ids
where boombox_ready is true;
