-- Roblox music IDs from the music discovery top songs list
create table if not exists public.roblox_music_ids (
  asset_id bigint primary key,
  title text not null,
  artist text not null,
  album text,
  duration_seconds integer,
  album_art_asset_id bigint,
  rank integer,
  source text not null default 'music_discovery_top_songs',
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_music_ids_rank on public.roblox_music_ids (rank);
create index if not exists idx_roblox_music_ids_last_seen on public.roblox_music_ids (last_seen_at desc);

create trigger trg_roblox_music_ids_updated_at
before update on public.roblox_music_ids
for each row
execute function public.set_updated_at();
