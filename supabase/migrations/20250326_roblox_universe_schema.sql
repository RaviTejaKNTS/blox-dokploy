-- Roblox universe-first schema (replaces legacy roblox_* tables)

drop table if exists public.roblox_game_stats cascade;
drop table if exists public.roblox_game_media cascade;
drop table if exists public.roblox_game_badges cascade;
drop table if exists public.roblox_game_passes cascade;
drop table if exists public.roblox_place_servers cascade;
drop table if exists public.roblox_search_snapshots cascade;
drop table if exists public.roblox_sort_entries cascade;
drop table if exists public.roblox_sort_definitions cascade;
drop table if exists public.roblox_sort_runs cascade;
drop table if exists public.roblox_games cascade;

create table if not exists public.roblox_universes (
  universe_id bigint primary key,
  root_place_id bigint not null,
  name text not null,
  display_name text,
  slug text,
  description text,
  description_source text,
  creator_id bigint,
  creator_name text,
  creator_type text,
  creator_has_verified_badge boolean,
  group_id bigint,
  group_name text,
  group_has_verified_badge boolean,
  visibility text,
  privacy_type text,
  is_active boolean,
  is_archived boolean,
  is_sponsored boolean,
  genre text,
  genre_l1 text,
  genre_l2 text,
  is_all_genre boolean,
  age_rating text,
  universe_avatar_type text,
  desktop_enabled boolean,
  mobile_enabled boolean,
  tablet_enabled boolean,
  console_enabled boolean,
  vr_enabled boolean,
  voice_chat_enabled boolean,
  price integer,
  private_server_price_robux integer,
  create_vip_servers_allowed boolean,
  studio_access_allowed boolean,
  max_players integer,
  server_size integer,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  icon_url text,
  thumbnail_urls jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  raw_metadata jsonb not null default '{}'::jsonb,
  raw_details jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_in_sort timestamptz,
  last_seen_in_search timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roblox_universes_creator on public.roblox_universes (creator_id);
create index if not exists idx_roblox_universes_slug on public.roblox_universes (lower(slug));
create index if not exists idx_roblox_universes_seen on public.roblox_universes (coalesce(last_seen_in_sort, last_seen_in_search) desc);

create table if not exists public.roblox_groups (
  group_id bigint primary key,
  name text not null,
  description text,
  member_count bigint,
  owner_id bigint,
  owner_name text,
  has_verified_badge boolean,
  raw_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.roblox_universe_social_links (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  platform text not null,
  title text,
  url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (universe_id, platform, url)
);

create table if not exists public.roblox_universe_media (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  media_type text not null check (media_type in ('icon','screenshot','video')),
  image_url text,
  video_url text,
  alt_text text,
  is_primary boolean not null default false,
  approved boolean,
  extra jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_roblox_universe_media_universe on public.roblox_universe_media (universe_id, media_type);

create table if not exists public.roblox_universe_badges (
  badge_id bigint primary key,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
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

create index if not exists idx_roblox_universe_badges on public.roblox_universe_badges (universe_id);

create table if not exists public.roblox_universe_gamepasses (
  pass_id bigint primary key,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
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

create index if not exists idx_roblox_universe_gamepasses on public.roblox_universe_gamepasses (universe_id);

create table if not exists public.roblox_universe_stats_daily (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  stat_date date not null,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint,
  premium_visits bigint,
  premium_upsells bigint,
  engagement_score numeric,
  payout_robux numeric,
  snapshot jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  unique (universe_id, stat_date)
);

create index if not exists idx_roblox_universe_stats_daily on public.roblox_universe_stats_daily (universe_id, stat_date desc);

create table if not exists public.roblox_universe_sort_runs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null,
  device text not null,
  country text not null,
  retrieved_at timestamptz not null default now()
);

create table if not exists public.roblox_universe_sort_definitions (
  sort_id text primary key,
  title text,
  description text,
  layout jsonb not null default '{}'::jsonb,
  experiments jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.roblox_universe_sort_entries (
  id uuid primary key default uuid_generate_v4(),
  sort_id text not null references public.roblox_universe_sort_definitions(sort_id) on delete cascade,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  place_id bigint,
  rank integer,
  session_id uuid not null,
  run_id uuid references public.roblox_universe_sort_runs(id) on delete cascade,
  device text,
  country text,
  source text not null default 'explore',
  is_sponsored boolean,
  fetched_at timestamptz not null default now(),
  unique(sort_id, universe_id, session_id, fetched_at)
);

create index if not exists idx_roblox_universe_sort_entries_sort on public.roblox_universe_sort_entries (sort_id, fetched_at desc);
create index if not exists idx_roblox_universe_sort_entries_universe on public.roblox_universe_sort_entries (universe_id, fetched_at desc);

create table if not exists public.roblox_universe_search_snapshots (
  id uuid primary key default uuid_generate_v4(),
  query text not null,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
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

create index if not exists idx_roblox_universe_search_snapshots_query on public.roblox_universe_search_snapshots (query, fetched_at desc);
create index if not exists idx_roblox_universe_search_snapshots_universe on public.roblox_universe_search_snapshots (universe_id, fetched_at desc);

create table if not exists public.roblox_universe_place_servers (
  id uuid primary key default uuid_generate_v4(),
  place_id bigint not null,
  universe_id bigint references public.roblox_universes(universe_id) on delete cascade,
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

create index if not exists idx_roblox_universe_place_servers_place on public.roblox_universe_place_servers (place_id, fetched_at desc);
create index if not exists idx_roblox_universe_place_servers_universe on public.roblox_universe_place_servers (universe_id, fetched_at desc);

drop trigger if exists trg_roblox_universes_updated_at on public.roblox_universes;
create trigger trg_roblox_universes_updated_at before update on public.roblox_universes
for each row execute function public.set_updated_at();

alter table public.roblox_universes enable row level security;
alter table public.roblox_groups enable row level security;
alter table public.roblox_universe_social_links enable row level security;
alter table public.roblox_universe_media enable row level security;
alter table public.roblox_universe_badges enable row level security;
alter table public.roblox_universe_gamepasses enable row level security;
alter table public.roblox_universe_stats_daily enable row level security;
alter table public.roblox_universe_sort_runs enable row level security;
alter table public.roblox_universe_sort_definitions enable row level security;
alter table public.roblox_universe_sort_entries enable row level security;
alter table public.roblox_universe_search_snapshots enable row level security;
alter table public.roblox_universe_place_servers enable row level security;
