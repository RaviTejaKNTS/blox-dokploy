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
  old_slugs text[] not null default '{}'::text[],
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
  troubleshoot_md text,
  rewards_md text,
  about_game_md text,
  description_md text,
  internal_links integer not null default 0,
  interlinking_ai jsonb not null default '{}'::jsonb,
  interlinking_ai_copy_md text,
  is_published boolean not null default false,
  re_rewritten_at timestamptz,
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
CREATE INDEX IF NOT EXISTS idx_games_old_slugs ON public.games USING gin (old_slugs);
create index if not exists idx_games_published_updated on public.games (is_published, updated_at desc);
create index if not exists idx_codes_game_first_seen on public.codes (game_id, first_seen_at desc);


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
create index if not exists idx_articles_published_published_at on public.articles (is_published, published_at desc);

-- Queue table for revalidation events
create table if not exists public.revalidation_events (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null check (entity_type in ('code','article','list','author')),
  slug text not null,
  source text,
  created_at timestamptz not null default now()
);

alter table if exists public.revalidation_events
  add constraint revalidation_events_entity_slug_key unique (entity_type, slug);

create index if not exists idx_revalidation_events_type_slug on public.revalidation_events (entity_type, slug);
create index if not exists idx_revalidation_events_created on public.revalidation_events (created_at desc);

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

-- Checklist pages and items with section codes stored on each item
create table if not exists public.checklist_pages (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  slug text not null,
  title text not null,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id, slug)
);

create index if not exists idx_checklist_pages_universe_slug on public.checklist_pages (universe_id, lower(slug));
create index if not exists idx_checklist_pages_published on public.checklist_pages (is_public, published_at desc nulls last, updated_at desc);

create table if not exists public.checklist_items (
  id uuid primary key default uuid_generate_v4(),
  page_id uuid not null references public.checklist_pages(id) on delete cascade,
  section_code text not null check (section_code ~ '^[0-9]+(\\.[0-9]+)?$'),
  section_name text not null,
  title text not null,
  description text,
  is_required boolean not null default false,
  position int not null default 1 check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, section_code, position, title)
);

create index if not exists idx_checklist_items_page_section on public.checklist_items (page_id, section_code, position);
create index if not exists idx_checklist_items_page on public.checklist_items (page_id);

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

drop trigger if exists trg_checklist_pages_updated_at on public.checklist_pages;
create trigger trg_checklist_pages_updated_at before update on public.checklist_pages
for each row execute function public.set_updated_at();

drop trigger if exists trg_checklist_items_updated_at on public.checklist_items;
create trigger trg_checklist_items_updated_at before update on public.checklist_items
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

-- helper to run SQL-driven game lists during refresh
create or replace function public.run_game_list_sql(
  sql_text text,
  limit_count int default null
)
returns table (
  universe_id bigint,
  rank int,
  metric_value numeric,
  reason text,
  extra jsonb,
  game_id uuid,
  playing bigint,
  visits bigint,
  favorites bigint,
  likes bigint,
  dislikes bigint
)
language plpgsql
set search_path = public
as $$
declare
  trimmed text;
  capped_limit int;
begin
  if sql_text is null or length(trim(sql_text)) = 0 then
    raise exception 'sql_text is required';
  end if;

  trimmed := ltrim(sql_text);
  if lower(left(trimmed, 6)) <> 'select' then
    raise exception 'sql_text must start with SELECT';
  end if;

  capped_limit := nullif(limit_count, 0);

  return query execute format(
    'select * from (%s) as src(universe_id, rank, metric_value, reason, extra, game_id, playing, visits, favorites, likes, dislikes) %s',
    sql_text,
    case
      when capped_limit is null then ''
      else format('limit %s', capped_limit)
    end
  );
end;
$$;

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

-- Views for page data aggregation

-- Codes/game pages view: game + author + universe + aggregated codes/counts + recommendations
drop view if exists public.code_pages_view;
create or replace view public.code_pages_view as
with code_stats as (
  select
    game_id,
    jsonb_agg(c order by c.status, c.last_seen_at desc) filter (where c.id is not null) as codes,
    count(*) filter (where c.status = 'active') as active_code_count,
    max(c.first_seen_at) filter (where c.status = 'active') as latest_code_first_seen_at
  from public.codes c
  group by game_id
) 
select
  g.id,
  g.name,
  g.slug,
  g.old_slugs,
  g.author_id,
  g.roblox_link,
  g.universe_id,
  g.community_link,
  g.discord_link,
  g.twitter_link,
  g.youtube_link,
  g.expired_codes,
  g.cover_image,
  g.seo_title,
  g.seo_description,
  g.intro_md,
  g.redeem_md,
  g.troubleshoot_md,
  g.rewards_md,
  g.about_game_md,
  g.description_md,
  g.internal_links,
  g.is_published,
  g.re_rewritten_at,
  g.created_at,
  g.updated_at,
  coalesce(cs.codes, '[]'::jsonb) as codes,
  coalesce(cs.active_code_count, 0) as active_code_count,
  cs.latest_code_first_seen_at,
  greatest(
    coalesce(cs.latest_code_first_seen_at, g.updated_at),
    g.updated_at
  ) as content_updated_at,
  case when a.id is null then null else jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'gravatar_email', a.gravatar_email,
    'avatar_url', a.avatar_url,
    'bio_md', a.bio_md,
    'twitter', a.twitter,
    'youtube', a.youtube,
    'website', a.website,
    'facebook', a.facebook,
    'linkedin', a.linkedin,
    'instagram', a.instagram,
    'roblox', a.roblox,
    'discord', a.discord,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  ) end as author,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name,
    'creator_name', u.creator_name,
    'creator_id', u.creator_id,
    'creator_type', u.creator_type,
    'social_links', u.social_links,
    'icon_url', u.icon_url,
    'playing', u.playing,
    'visits', u.visits,
    'favorites', u.favorites,
    'likes', u.likes,
    'dislikes', u.dislikes,
    'age_rating', u.age_rating,
    'desktop_enabled', u.desktop_enabled,
    'mobile_enabled', u.mobile_enabled,
    'tablet_enabled', u.tablet_enabled,
    'console_enabled', u.console_enabled,
    'vr_enabled', u.vr_enabled,
    'updated_at', u.updated_at,
    'description', u.description,
    'game_description_md', u.game_description_md
  ) end as universe,
  (
    select coalesce(
      jsonb_agg(rec order by rec.active_code_count desc, rec.updated_at desc),
      '[]'::jsonb
    )
    from (
      select
        g2.id,
        g2.name,
        g2.slug,
        g2.cover_image,
        coalesce(cs2.active_code_count, 0) as active_code_count,
        greatest(coalesce(cs2.latest_code_first_seen_at, g2.updated_at), g2.updated_at) as content_updated_at,
        g2.updated_at
      from public.games g2
      left join code_stats cs2 on cs2.game_id = g2.id
      where g2.is_published = true
        and g2.id <> g.id
      order by coalesce(cs2.active_code_count, 0) desc, g2.updated_at desc
      limit 6
    ) rec
  ) as recommended_games,
  g.interlinking_ai_copy_md
from public.games g
left join code_stats cs on cs.game_id = g.id
left join public.authors a on a.id = g.author_id
left join public.roblox_universes u on u.universe_id = g.universe_id;

-- Articles view: article + author + universe JSON + related articles
create or replace view public.article_pages_view as
select
  art.*,
  case when a.id is null then null else jsonb_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'gravatar_email', a.gravatar_email,
    'avatar_url', a.avatar_url,
    'bio_md', a.bio_md,
    'twitter', a.twitter,
    'youtube', a.youtube,
    'website', a.website,
    'facebook', a.facebook,
    'linkedin', a.linkedin,
    'instagram', a.instagram,
    'roblox', a.roblox,
    'discord', a.discord,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  ) end as author,
  case when u.universe_id is null then null else jsonb_build_object(
    'universe_id', u.universe_id,
    'slug', u.slug,
    'display_name', u.display_name,
    'name', u.name
  ) end as universe,
  (
    select coalesce(
      jsonb_agg(rec order by rec.published_at desc),
      '[]'::jsonb
    )
    from (
      select
        a2.id,
        a2.title,
        a2.slug,
        a2.cover_image,
        a2.published_at,
        a2.updated_at,
        case when a3.id is null then null else jsonb_build_object(
          'id', a3.id,
          'name', a3.name,
          'slug', a3.slug,
          'avatar_url', a3.avatar_url,
          'gravatar_email', a3.gravatar_email
        ) end as author
      from public.articles a2
      left join public.authors a3 on a3.id = a2.author_id
      where a2.is_published = true
        and a2.id <> art.id
      order by a2.published_at desc
      limit 6
    ) rec
  ) as related_articles
from public.articles art
left join public.authors a on a.id = art.author_id
left join public.roblox_universes u on u.universe_id = art.universe_id;

-- Game lists view: list + aggregated entries with universe/game details + badges + other lists
create or replace view public.game_lists_view as
select
  l.*,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'universe_id', e.universe_id,
        'list_id', e.list_id,
        'rank', e.rank,
        'metric_value', e.metric_value,
        'reason', e.reason,
        'extra', e.extra,
        'game_id', e.game_id,
        'game', case when g.id is null then null else jsonb_build_object(
          'id', g.id,
          'name', g.name,
          'slug', g.slug,
          'cover_image', g.cover_image,
          'universe_id', g.universe_id
        ) end,
        'universe', case when u.universe_id is null then null else jsonb_build_object(
          'universe_id', u.universe_id,
          'slug', u.slug,
          'display_name', u.display_name,
          'name', u.name,
          'icon_url', u.icon_url,
          'playing', u.playing,
          'visits', u.visits,
          'favorites', u.favorites,
          'likes', u.likes,
          'dislikes', u.dislikes,
          'age_rating', u.age_rating,
          'desktop_enabled', u.desktop_enabled,
          'mobile_enabled', u.mobile_enabled,
          'tablet_enabled', u.tablet_enabled,
          'console_enabled', u.console_enabled,
          'vr_enabled', u.vr_enabled,
          'updated_at', u.updated_at,
          'description', u.description,
          'game_description_md', u.game_description_md
        ) end,
        'badges',
          (
            select coalesce(
              jsonb_agg(rec order by rec.rank),
              '[]'::jsonb
            )
            from (
              select
                gle2.list_id,
                gl2.slug as list_slug,
                gl2.title as list_title,
                gle2.rank
              from public.game_list_entries gle2
              join public.game_lists gl2 on gl2.id = gle2.list_id and gl2.is_published = true
              where gle2.universe_id = e.universe_id
                and (gl2.id <> l.id)
                and gle2.rank between 1 and 3
              order by gle2.rank
              limit 3
            ) rec
          )
      )
      order by e.rank
    ) filter (where e.universe_id is not null),
    '[]'::jsonb
  ) as entries,
  (
    select coalesce(
      jsonb_agg(rec order by rec.updated_at desc),
      '[]'::jsonb
    )
    from (
      select
        l2.id,
        l2.slug,
        l2.title,
        l2.updated_at
      from public.game_lists l2
      where l2.is_published = true
        and l2.id <> l.id
      order by l2.updated_at desc
      limit 6
    ) rec
  ) as other_lists
from public.game_lists l
left join public.game_list_entries e on e.list_id = l.id
left join public.roblox_universes u on u.universe_id = e.universe_id
left join public.games g on g.id = e.game_id
group by l.id;

-- tools table for calculator/tool pages
create table if not exists public.tools (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  title text not null,
  seo_title text not null,
  meta_description text not null,
  intro_md text not null,
  how_it_works_md text not null,
  description_json jsonb not null default '{}'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_url text,
  schema_ld_json jsonb,
  thumb_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tools_is_published on public.tools (is_published);

create trigger trg_tools_updated_at
before update on public.tools
for each row
execute function public.set_updated_at();
