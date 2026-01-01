-- Add boombox verification + popularity fields and view
alter table if exists public.roblox_music_ids
  add column if not exists boombox_ready boolean not null default false,
  add column if not exists boombox_ready_reason text,
  add column if not exists verified_at timestamptz,
  add column if not exists product_info_json jsonb,
  add column if not exists asset_delivery_status integer,
  add column if not exists vote_count bigint,
  add column if not exists upvote_percent integer,
  add column if not exists creator_verified boolean,
  add column if not exists popularity_score double precision not null default 0;

create index if not exists idx_roblox_music_ids_boombox_ready
  on public.roblox_music_ids (boombox_ready);

create index if not exists idx_roblox_music_ids_popularity_score
  on public.roblox_music_ids (popularity_score desc);

create index if not exists idx_roblox_music_ids_verified_at
  on public.roblox_music_ids (verified_at);

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
