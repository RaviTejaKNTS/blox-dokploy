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
  article_title text not null,
  category_id uuid references public.article_categories(id) on delete set null,
  article_type text not null check (article_type in ('listicle','how_to','explainer','opinion','news')),
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


-- article categories table
create table if not exists public.article_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  description text,
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_article_categories_slug on public.article_categories (lower(slug));
create index if not exists idx_article_categories_game on public.article_categories (game_id);

-- articles table
create table if not exists public.articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  slug text not null unique,
  content_md text not null,
  cover_image text,
  author_id uuid references public.authors(id) on delete set null,
  category_id uuid references public.article_categories(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  word_count int,
  meta_description text
);

create index if not exists idx_articles_published on public.articles (is_published);
create index if not exists idx_articles_slug on public.articles (lower(slug));
create index if not exists idx_articles_category on public.articles (category_id, is_published);
create index if not exists idx_articles_author on public.articles (author_id, is_published);

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

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists trg_article_categories_updated_at on public.article_categories;
create trigger trg_article_categories_updated_at before update on public.article_categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_articles_updated_at on public.articles;
create trigger trg_articles_updated_at before update on public.articles
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
alter table public.article_categories enable row level security;
alter table public.articles enable row level security;
alter table public.game_generation_queue enable row level security;
alter table public.article_generation_queue enable row level security;

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

drop policy if exists "read_article_categories" on public.article_categories;
create policy "read_article_categories" on public.article_categories
  for select using (true);

drop policy if exists "admin_manage_article_categories" on public.article_categories;
create policy "admin_manage_article_categories" on public.article_categories
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
