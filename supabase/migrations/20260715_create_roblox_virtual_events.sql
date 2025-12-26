-- Roblox virtual events data
create table if not exists public.roblox_virtual_events (
  event_id text primary key,
  universe_id bigint not null references public.roblox_universes(universe_id) on delete restrict,
  place_id bigint,
  title text,
  display_title text,
  subtitle text,
  display_subtitle text,
  description text,
  display_description text,
  tagline text,
  start_utc timestamptz,
  end_utc timestamptz,
  created_utc timestamptz,
  updated_utc timestamptz,
  event_status text,
  event_visibility text,
  featuring_status text,
  all_thumbnails_created boolean,
  host_name text,
  host_has_verified_badge boolean,
  host_type text,
  host_id bigint,
  event_summary_md text,
  event_details_md text,
  guide_slug text,
  raw_event_json jsonb
);

create table if not exists public.roblox_virtual_event_categories (
  event_id text not null references public.roblox_virtual_events(event_id) on delete cascade,
  category text not null,
  rank integer not null,
  primary key (event_id, rank)
);

create table if not exists public.roblox_virtual_event_thumbnails (
  event_id text not null references public.roblox_virtual_events(event_id) on delete cascade,
  media_id bigint not null,
  rank integer not null,
  primary key (event_id, rank)
);

create index if not exists idx_roblox_virtual_events_universe_id
  on public.roblox_virtual_events (universe_id);
create index if not exists idx_roblox_virtual_events_start_utc
  on public.roblox_virtual_events (start_utc);
create index if not exists idx_roblox_virtual_events_event_status
  on public.roblox_virtual_events (event_status);

alter table if exists public.roblox_virtual_events
  alter column universe_id set not null;

alter table if exists public.roblox_virtual_events
  drop constraint if exists roblox_virtual_events_universe_id_fkey;

alter table if exists public.roblox_virtual_events
  add constraint roblox_virtual_events_universe_id_fkey
  foreign key (universe_id)
  references public.roblox_universes(universe_id)
  on delete restrict;

alter table if exists public.roblox_virtual_events
  add column if not exists event_summary_md text;

alter table if exists public.roblox_virtual_events
  add column if not exists event_details_md text;

alter table if exists public.roblox_virtual_events
  add column if not exists guide_slug text;

-- Event pages (one per universe)
create table if not exists public.events_pages (
  id uuid primary key default uuid_generate_v4(),
  universe_id bigint not null references public.roblox_universes(universe_id) on delete cascade,
  slug text,
  title text not null,
  content_md text,
  seo_title text,
  meta_description text,
  is_published boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (universe_id)
);

alter table if exists public.events_pages
  add column if not exists slug text;

create index if not exists idx_events_pages_is_published on public.events_pages (is_published);
create unique index if not exists idx_events_pages_slug on public.events_pages (slug);

drop trigger if exists trg_events_pages_updated_at on public.events_pages;
create trigger trg_events_pages_updated_at
before update on public.events_pages
for each row
execute function public.set_updated_at();

drop trigger if exists trg_set_events_pages_published_at on public.events_pages;
create trigger trg_set_events_pages_published_at
before insert or update on public.events_pages
for each row
execute function public.set_catalog_page_published_at();
