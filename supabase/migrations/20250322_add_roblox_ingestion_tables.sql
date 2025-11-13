-- Roblox ingestion tables and supporting indexes

create table if not exists public.roblox_games (
  universe_id bigint primary key,
  root_place_id bigint not null,
  name text not null,
  display_name text,
  slug text,
  description text,
  creator_id bigint,
  creator_name text,
  creator_type text,
  creator_has_verified_badge boolean,
  genre text,
  source_name text,
  source_session_id uuid,
  price integer,
  voice_enabled boolean,
  server_size integer,
  max_players integer,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  age_recommendation text,
  allowed_gear_categories text[],
  is_experimental boolean,
  is_genre_enforced boolean,
  is_playable boolean,
  is_sponsored boolean,
  has_verified_badge boolean,
  studio_access_allowed boolean,
  create_vip_servers_allowed boolean,
  universe_avatar_type text,
  icon_url text,
  icon_state text,
  thumbnail_urls jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  raw_details jsonb not null default '{}'::jsonb,
  raw_social jsonb not null default '{}'::jsonb,
  raw_media jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_in_sort timestamptz,
  last_seen_in_search timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_games_creator on public.roblox_games (creator_id);
create index if not exists idx_roblox_games_slug on public.roblox_games (lower(slug));
create index if not exists idx_roblox_games_seen on public.roblox_games (coalesce(last_seen_in_sort, last_seen_in_search) desc);

create table if not exists public.roblox_game_media (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_games(universe_id) on delete cascade,
  media_type text not null check (media_type in ('icon','thumbnail')),
  image_url text not null,
  size text,
  state text,
  is_primary boolean not null default false,
  extra jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_roblox_game_media_universe on public.roblox_game_media (universe_id, media_type);

create table if not exists public.roblox_game_badges (
  badge_id bigint primary key,
  universe_id bigint not null references public.roblox_games(universe_id) on delete cascade,
  name text not null,
  description text,
  icon_image_id bigint,
  icon_image_url text,
  awarding_badge_asset_id bigint,
  enabled boolean,
  awarded_count bigint,
  awarded_past_day bigint,
  awarded_past_week bigint,
  rarity_percent numeric,
  stats_updated_at timestamptz,
  created_at_api timestamptz,
  updated_at_api timestamptz,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_roblox_game_badges_universe on public.roblox_game_badges (universe_id);

create table if not exists public.roblox_game_passes (
  pass_id bigint primary key,
  universe_id bigint not null references public.roblox_games(universe_id) on delete cascade,
  product_id bigint,
  name text not null,
  description text,
  price integer,
  is_for_sale boolean,
  sales bigint,
  icon_image_id bigint,
  icon_image_url text,
  created_at_api timestamptz,
  updated_at_api timestamptz,
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_roblox_game_passes_universe on public.roblox_game_passes (universe_id);

create table if not exists public.roblox_sort_runs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null,
  device text not null,
  country text not null,
  retrieved_at timestamptz not null default now()
);

create table if not exists public.roblox_sort_definitions (
  sort_id text primary key,
  title text,
  description text,
  layout jsonb not null default '{}'::jsonb,
  experiments jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.roblox_sort_entries (
  id uuid primary key default uuid_generate_v4(),
  sort_id text not null references public.roblox_sort_definitions(sort_id) on delete cascade,
  universe_id bigint not null references public.roblox_games(universe_id) on delete cascade,
  place_id bigint,
  rank integer,
  session_id uuid not null,
  run_id uuid references public.roblox_sort_runs(id) on delete cascade,
  device text,
  country text,
  source text not null default 'explore',
  is_sponsored boolean,
  fetched_at timestamptz not null default now(),
  unique(sort_id, universe_id, session_id, fetched_at)
);

create index if not exists idx_roblox_sort_entries_sort on public.roblox_sort_entries (sort_id, fetched_at desc);
create index if not exists idx_roblox_sort_entries_universe on public.roblox_sort_entries (universe_id, fetched_at desc);

create table if not exists public.roblox_search_snapshots (
  id uuid primary key default uuid_generate_v4(),
  query text not null,
  universe_id bigint not null references public.roblox_games(universe_id) on delete cascade,
  place_id bigint,
  position integer,
  session_id uuid not null,
  relevance_score numeric,
  has_verified_badge boolean,
  is_sponsored boolean,
  source text not null default 'omni-search',
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_roblox_search_snapshots_query on public.roblox_search_snapshots (query, fetched_at desc);
create index if not exists idx_roblox_search_snapshots_universe on public.roblox_search_snapshots (universe_id, fetched_at desc);

create table if not exists public.roblox_place_servers (
  id uuid primary key default uuid_generate_v4(),
  place_id bigint not null,
  universe_id bigint references public.roblox_games(universe_id) on delete cascade,
  server_id text not null,
  region text,
  ping_ms integer,
  fps numeric,
  player_count integer,
  max_players integer,
  player_list jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  unique(place_id, server_id, fetched_at)
);

create index if not exists idx_roblox_place_servers_place on public.roblox_place_servers (place_id, fetched_at desc);
create index if not exists idx_roblox_place_servers_universe on public.roblox_place_servers (universe_id, fetched_at desc);

create table if not exists public.roblox_game_stats (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_games(universe_id) on delete cascade,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  stats jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_roblox_game_stats_universe on public.roblox_game_stats (universe_id, recorded_at desc);

drop trigger if exists trg_roblox_games_updated_at on public.roblox_games;
create trigger trg_roblox_games_updated_at before update on public.roblox_games
for each row execute function public.set_updated_at();

alter table public.roblox_games enable row level security;
alter table public.roblox_game_media enable row level security;
alter table public.roblox_game_badges enable row level security;
alter table public.roblox_game_passes enable row level security;
alter table public.roblox_sort_runs enable row level security;
alter table public.roblox_sort_definitions enable row level security;
alter table public.roblox_sort_entries enable row level security;
alter table public.roblox_search_snapshots enable row level security;
alter table public.roblox_place_servers enable row level security;
alter table public.roblox_game_stats enable row level security;
