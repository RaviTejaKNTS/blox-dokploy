-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- authors table
create table if not exists public.authors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  gravatar_email text,
  avatar_url text,
  bio_md text,
  twitter text,
  youtube text,
  website text,
  facebook text,
  linkedin text,
  instagram text,
  roblox text,
  discord text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- games table
create table if not exists public.games (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  author_id uuid references public.authors(id),
  source_url text,
  source_url_2 text,
  source_url_3 text,
  roblox_link text,
  universe_id bigint references public.roblox_universes(universe_id),
  community_link text,
  discord_link text,
  twitter_link text,
  expired_codes jsonb not null default '[]'::jsonb,
  cover_image text,
  seo_title text,
  seo_description text,
  intro_md text,
  redeem_md text,
  description_md text,
  linktext_md text,
  genre text,
  sub_genre text,
  internal_links integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- roblox universes table
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

-- roblox groups
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

-- roblox universe social links
create table if not exists public.roblox_universe_social_links (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  platform text not null,
  title text,
  url text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

create unique index if not exists idx_roblox_universe_social_links_unique on public.roblox_universe_social_links (universe_id, platform, url);

-- roblox universe media (icons, screenshots, videos)
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

-- roblox universe badges
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

-- roblox universe game passes
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

-- roblox universe stats (daily snapshots)
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

-- roblox explore sorts and runs
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

-- roblox search snapshots
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

-- roblox place server snapshots
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

-- codes table
create table if not exists public.codes (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid not null references public.games(id) on delete cascade,
  code text not null,
  status text not null check (status in ('active','expired','check')),
  rewards_text text,
  level_requirement int,
  is_new boolean,
  provider_priority int not null default 0,
  posted_online boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (game_id, code)
);

drop index if exists idx_codes_game_status;
create index if not exists idx_codes_game_status_seen on public.codes (game_id, status, last_seen_at desc);
create index if not exists idx_codes_status_game on public.codes (status, game_id);
create index if not exists idx_games_published on public.games (is_published);
create index if not exists idx_games_published_name on public.games (is_published, name);
create index if not exists idx_games_author_published on public.games (author_id, is_published);
create unique index if not exists idx_codes_game_code_upper on public.codes (game_id, upper(code));
CREATE INDEX IF NOT EXISTS idx_games_slug ON public.games (LOWER(slug));


-- game generation queue table
create table if not exists public.game_generation_queue (
  id uuid primary key default uuid_generate_v4(),
  game_name text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','failed','skipped')),
  attempts int not null default 0,
  last_attempted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_generation_queue_status_created
  on public.game_generation_queue (status, created_at);

-- article generation queue table
create table if not exists public.article_generation_queue (
  id uuid primary key default uuid_generate_v4(),
  article_title text,
  article_type text check (article_type in ('listicle','how_to','explainer','opinion','news')),
  sources text,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  attempts int not null default 0,
  last_attempted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_article_generation_queue_status_created
  on public.article_generation_queue (status, created_at);


-- admin users table
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_users_role on public.admin_users (role);

-- articles table
create table if not exists public.articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  content_md text not null,
  cover_image text,
  author_id uuid references public.authors(id) on delete set null,
  universe_id bigint references public.roblox_universes(universe_id),
  is_published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  word_count int,
  meta_description text
);

create index if not exists idx_articles_published on public.articles (is_published);
create index if not exists idx_articles_slug on public.articles (lower(slug));
create index if not exists idx_articles_author on public.articles (author_id, is_published);
create index if not exists idx_articles_universe on public.articles (universe_id);

create index if not exists idx_games_universe_id on public.games (universe_id);

-- game lists metadata for curated list pages
create table if not exists public.game_lists (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  hero_md text,
  intro_md text,
  outro_md text,
  meta_title text,
  meta_description text,
  cover_image text,
  list_type text not null default 'sql' check (list_type in ('sql','manual','hybrid')),
  filter_config jsonb not null default '{}'::jsonb,
  limit_count int not null default 50 check (limit_count > 0),
  is_published boolean not null default false,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_lists_slug on public.game_lists (lower(slug));
create index if not exists idx_game_lists_published on public.game_lists (is_published, updated_at desc);

create table if not exists public.game_list_entries (
  list_id uuid not null references public.game_lists(id) on delete cascade,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  rank int not null,
  metric_value numeric,
  reason text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (list_id, universe_id)
);

create index if not exists idx_game_list_entries_rank on public.game_list_entries (list_id, rank);
create index if not exists idx_game_list_entries_game on public.game_list_entries (game_id);
create index if not exists idx_game_list_entries_universe on public.game_list_entries (universe_id);

-- trigger to update updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at before update on public.games
for each row execute function public.set_updated_at();

drop trigger if exists trg_authors_updated_at on public.authors;
create trigger trg_authors_updated_at before update on public.authors
for each row execute function public.set_updated_at();

drop trigger if exists trg_game_lists_updated_at on public.game_lists;
create trigger trg_game_lists_updated_at before update on public.game_lists
for each row execute function public.set_updated_at();

drop trigger if exists trg_game_list_entries_updated_at on public.game_list_entries;
create trigger trg_game_list_entries_updated_at before update on public.game_list_entries
for each row execute function public.set_updated_at();

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_articles_updated_at on public.articles;
create trigger trg_articles_updated_at before update on public.articles
for each row execute function public.set_updated_at();

drop trigger if exists trg_roblox_universes_updated_at on public.roblox_universes;
create trigger trg_roblox_universes_updated_at before update on public.roblox_universes
for each row execute function public.set_updated_at();

drop trigger if exists trg_game_generation_queue_updated_at on public.game_generation_queue;
create trigger trg_game_generation_queue_updated_at before update on public.game_generation_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_article_generation_queue_updated_at on public.article_generation_queue;
create trigger trg_article_generation_queue_updated_at before update on public.article_generation_queue
for each row execute function public.set_updated_at();

-- RLS
alter table public.games enable row level security;
alter table public.codes enable row level security;
alter table public.authors enable row level security;
alter table public.admin_users enable row level security;
alter table public.articles enable row level security;
alter table public.game_generation_queue enable row level security;
alter table public.article_generation_queue enable row level security;
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

-- Policy: allow read of published games and their codes to anon
drop policy if exists "read_published_games" on public.games;
create policy "read_published_games" on public.games
  for select using (is_published = true);

drop policy if exists "admin_manage_games" on public.games;
create policy "admin_manage_games" on public.games
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

drop policy if exists "read_codes_of_published_games" on public.codes;
create policy "read_codes_of_published_games" on public.codes
  for select using (
    exists (select 1 from public.games g where g.id = codes.game_id and g.is_published = true)
  );

drop policy if exists "admin_manage_codes" on public.codes;
create policy "admin_manage_codes" on public.codes
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

drop policy if exists "read_authors" on public.authors;
create policy "read_authors" on public.authors
  for select using (true);

drop policy if exists "admin_manage_authors" on public.authors;
create policy "admin_manage_authors" on public.authors
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

drop policy if exists "admin_read_self" on public.admin_users;
create policy "admin_read_self" on public.admin_users
  for select using (auth.uid() = user_id);

drop policy if exists "admin_manage_game_generation_queue" on public.game_generation_queue;
create policy "admin_manage_game_generation_queue" on public.game_generation_queue
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

drop policy if exists "admin_manage_article_generation_queue" on public.article_generation_queue;
create policy "admin_manage_article_generation_queue" on public.article_generation_queue
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

drop policy if exists "read_published_articles" on public.articles;
create policy "read_published_articles" on public.articles
  for select using (is_published = true);

drop policy if exists "admin_manage_articles" on public.articles;
create policy "admin_manage_articles" on public.articles
  for all
  using (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users au where au.user_id = auth.uid()
    )
  );

-- Admin insert/update via service role (bypass RLS)
-- Upsert helper for codes (ensures last_seen_at is bumped; first_seen_at preserved)
create or replace function public.upsert_code(
  p_game_id uuid,
  p_code text,
  p_status text,
  p_rewards_text text,
  p_level_requirement int,
  p_is_new boolean,
  p_provider_priority int default 0
) returns void as $$
declare
  v_code text;
  v_existing_id uuid;
begin
  v_code := nullif(btrim(p_code), '');
  if v_code is null then
    return;
  end if;

  select id
  into v_existing_id
  from public.codes
  where game_id = p_game_id
    and upper(code) = upper(v_code)
  limit 1;

  if v_existing_id is null then
    begin
      insert into public.codes (game_id, code, status, rewards_text, level_requirement, is_new, provider_priority)
      values (p_game_id, v_code, p_status, p_rewards_text, p_level_requirement, p_is_new, p_provider_priority)
      on conflict (game_id, code) do update
        set status = excluded.status,
            rewards_text = excluded.rewards_text,
            level_requirement = excluded.level_requirement,
            is_new = excluded.is_new,
            provider_priority = excluded.provider_priority,
            last_seen_at = now(),
            code = excluded.code;
    exception
      when unique_violation then
        update public.codes
        set code = v_code,
            status = p_status,
            rewards_text = p_rewards_text,
            level_requirement = p_level_requirement,
            is_new = p_is_new,
            provider_priority = p_provider_priority,
            last_seen_at = now()
        where game_id = p_game_id
          and upper(code) = upper(v_code);
    end;
  else
    update public.codes
    set code = v_code,
        status = p_status,
        rewards_text = p_rewards_text,
        level_requirement = p_level_requirement,
        is_new = p_is_new,
        provider_priority = p_provider_priority,
        last_seen_at = now()
    where id = v_existing_id;
  end if;
end;
$$ language plpgsql;
alter table public.codes
  add column if not exists posted_online boolean not null default false;
